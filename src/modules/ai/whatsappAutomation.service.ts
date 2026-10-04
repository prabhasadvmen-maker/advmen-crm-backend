import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/AppError.js';
import { InvoiceModel } from '../invoices-payments/invoice.model.js';
import { LeadModel } from '../leads/lead.model.js';
import { AiGateway } from './ai.gateway.js';
import { IWhatsAppDraft, WhatsAppDraftModel } from './whatsappDraft.model.js';

const LEAD_SCAN_SIZE = 100;
const MAX_DRAFTS_PER_REQUEST = 5;

class WhatsAppDeliveryUnknownError extends Error {}

type LeadRecord = {
  _id: mongoose.Types.ObjectId;
  leadId: string;
  name: string;
  phone: string;
  status: string;
  consent?: {
    channel: string;
    purpose: string;
    status: string;
    evidence?: string;
    capturedAt?: Date;
  };
  queries?: Array<{ id: string; text: string; status: string; createdAt: Date }>;
  clearedInfo?: { clearedAt?: Date; dealValue?: number; paymentTotalPaid?: number };
  budget?: number;
};

type DraftBatchResult = {
  created: number;
  scanned: number;
  hasMore: boolean;
  nextCursor: string | null;
};

function validWhatsAppNumber(phone: string): boolean {
  const trimmed = phone.trim();
  if (!trimmed.startsWith('+')) return false;
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 && !digits.startsWith('0');
}

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function sourceKey(leadId: string, queryId: string, outstandingAmount: number): string {
  return createHash('sha256')
    .update(`${leadId}:${queryId}:${outstandingAmount.toFixed(2)}`)
    .digest('hex');
}

function isExplicitWhatsAppConsent(consent?: LeadRecord['consent']): boolean {
  return (
    consent?.channel === 'WHATSAPP' &&
    consent.status === 'GRANTED' &&
    typeof consent.evidence === 'string' &&
    consent.evidence.trim().length > 0
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function classifyQueryTopic(text: string): string {
  const query = text.toLowerCase();
  if (/\b(invoice|payment|paid|balance|billing|charge)\b/.test(query)) return 'billing';
  if (/\b(price|pricing|quote|proposal|cost|budget)\b/.test(query)) return 'pricing';
  if (/\b(demo|feature|product|integration|setup)\b/.test(query)) return 'product information';
  if (/\b(issue|problem|error|not working|support)\b/.test(query)) return 'support';
  return 'general follow-up';
}

export class WhatsAppAutomationService {
  async searchConsentLeads(organizationId: string, search: string) {
    const query = search.trim();
    if (query.length < 2) throw AppError.badRequest('Enter at least 2 characters to search leads');

    return LeadModel.find({
      organizationId,
      phone: { $type: 'string', $ne: '' },
      $and: [
        {
          $or: [
            { name: { $regex: escapeRegex(query), $options: 'i' } },
            { phone: { $regex: escapeRegex(query), $options: 'i' } },
            { leadId: { $regex: escapeRegex(query), $options: 'i' } },
          ],
        },
      ],
    })
      .select('_id leadId name phone consent.channel consent.status')
      .sort({ name: 1 })
      .limit(15)
      .lean();
  }

  async updateWhatsAppConsent(
    organizationId: string,
    leadId: string,
    userId: string,
    status: 'GRANTED' | 'REVOKED' | 'OPT_OUT',
    evidence?: string
  ): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(leadId)) throw AppError.badRequest('Invalid lead ID');
    const lead = await LeadModel.findOne({ _id: leadId, organizationId }).select('_id phone consent');
    if (!lead) throw AppError.notFound('Lead');

    if (status === 'GRANTED') {
      const evidenceText = evidence?.trim();
      if (!evidenceText || evidenceText.length < 5) {
        throw AppError.badRequest('Evidence of the customer’s WhatsApp opt-in is required');
      }
      if (!validWhatsAppNumber(lead.phone)) {
        throw AppError.badRequest('Record a valid international phone number before WhatsApp consent');
      }
      lead.set('consent', {
        channel: 'WHATSAPP',
        purpose: 'SALES_FOLLOW_UP',
        status,
        capturedAt: new Date(),
        capturedBy: userId,
        evidence: evidenceText.slice(0, 500),
      });
    } else {
      if (
        lead.consent?.channel !== 'WHATSAPP' ||
        lead.consent.status !== 'GRANTED'
      ) {
        throw AppError.conflict('This lead does not have active WhatsApp consent');
      }
      lead.set('consent.status', status);
      lead.set('consent.revokedAt', new Date());
      lead.set('consent.capturedBy', userId);
    }
    await lead.save();
  }

  async generateNextDraftBatch(
    organizationId: string,
    userId: string,
    cursor?: string
  ): Promise<DraftBatchResult> {
    if (cursor && !mongoose.Types.ObjectId.isValid(cursor)) {
      throw AppError.badRequest('Invalid WhatsApp draft cursor');
    }

    const filter: Record<string, unknown> = {
      organizationId,
      'consent.channel': 'WHATSAPP',
      'consent.status': 'GRANTED',
      'consent.evidence': { $type: 'string', $ne: '' },
      phone: { $type: 'string', $ne: '' },
      $or: [
        { 'queries.0': { $exists: true } },
        { 'clearedInfo.clearedAt': { $exists: true } },
        { status: 'WON' },
      ],
    };
    if (cursor) filter._id = { $gt: new mongoose.Types.ObjectId(cursor) };

    const leads = (await LeadModel.find(filter)
      .select('_id leadId name phone status consent queries clearedInfo budget')
      .sort({ _id: 1 })
      .limit(LEAD_SCAN_SIZE)
      .lean()) as unknown as LeadRecord[];

    if (leads.length === 0) {
      return { created: 0, scanned: 0, hasMore: false, nextCursor: null };
    }

    const invoiceLeadIds = leads.flatMap((lead) => [lead._id.toString(), lead.leadId]);
    const paidInvoices = await InvoiceModel.aggregate<{ _id: string; paid: number }>([
      {
        $match: {
          organizationId,
          status: 'PAID',
          $or: [
            { leadId: { $in: invoiceLeadIds } },
            { manualPaymentLeadId: { $in: invoiceLeadIds } },
          ],
        },
      },
      {
        $group: {
          _id: { $ifNull: ['$leadId', '$manualPaymentLeadId'] },
          paid: { $sum: '$amount' },
        },
      },
    ]);
    const paidByLeadId = new Map(paidInvoices.map((invoice) => [invoice._id, invoice.paid]));

    let created = 0;
    let scanned = 0;
    let lastScannedId: string | null = null;
    let stoppedEarly = false;

    for (let index = 0; index < leads.length; index += 1) {
      const lead = leads[index];
      scanned += 1;
      lastScannedId = lead._id.toString();

      if (!isExplicitWhatsAppConsent(lead.consent) || !validWhatsAppNumber(lead.phone)) continue;

      const openQuery = [...(lead.queries || [])]
        .filter((query) => query.status === 'OPEN' && query.text.trim())
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];
      const totalValue = lead.clearedInfo?.clearedAt
        ? Number(lead.clearedInfo.dealValue ?? lead.budget ?? 0)
        : 0;
      const recordedPayments = Math.max(
        Number(lead.clearedInfo?.paymentTotalPaid || 0),
        Number(paidByLeadId.get(lead._id.toString()) || 0),
        Number(paidByLeadId.get(lead.leadId) || 0)
      );
      const outstandingAmount = Math.max(0, Number((totalValue - recordedPayments).toFixed(2)));

      if (!openQuery && outstandingAmount <= 0) continue;

      const currentSourceKey = sourceKey(lead._id.toString(), openQuery?.id || '', outstandingAmount);
      const alreadyExists = await WhatsAppDraftModel.exists({
        organizationId,
        sourceKey: currentSourceKey,
      });
      if (alreadyExists) continue;

      const aiResult = await AiGateway.execute({
        organizationId,
        userId,
        feature: 'whatsapp_followup',
        temperature: 0.4,
        systemInstruction:
          'Write one concise, respectful customer-facing WhatsApp follow-up based only on the supplied topic category. Do not invent names, dates, promises, payment terms, or amounts. Do not state any amount; the CRM will append the verified balance. Return message text only, with no quotes or explanation.',
        prompt: [
          openQuery ? `Customer follow-up topic category: ${classifyQueryTopic(openQuery.text)}` : '',
          outstandingAmount > 0
            ? `There is a recorded outstanding balance. Mention that the customer can contact the team to discuss it, but do not include an amount.`
            : '',
        ]
          .filter(Boolean)
          .join('\n'),
      });
      if (
        aiResult.provider === 'local-deterministic' ||
        !aiResult.output.trim() ||
        aiResult.output.startsWith('AI Analysis complete for whatsapp_followup:')
      ) {
        throw AppError.badRequest(
          'Configure a working AI provider before generating customer-facing WhatsApp drafts'
        );
      }

      const generatedText = aiResult.output
        .replace(/^["'“”]+|["'“”]+$/g, '')
        .trim()
        .slice(0, 1500);
      const amountLine =
        outstandingAmount > 0 ? ` The recorded outstanding balance is ${formatINR(outstandingAmount)}.` : '';
      const message = `${generatedText}${amountLine}`;

      try {
        await WhatsAppDraftModel.create({
          organizationId,
          leadId: lead._id.toString(),
          sourceKey: currentSourceKey,
          leadName: lead.name,
          recipientPhone: lead.phone.trim(),
          queryText: openQuery?.text,
          outstandingAmount,
          currency: 'INR',
          message,
          status: 'PENDING_APPROVAL',
          generatedBy: userId,
        });
        created += 1;
      } catch (error) {
        if (!(error instanceof mongoose.mongo.MongoServerError) || error.code !== 11000) throw error;
      }

      if (created >= MAX_DRAFTS_PER_REQUEST) {
        stoppedEarly = index < leads.length - 1;
        break;
      }
    }

    return {
      created,
      scanned,
      hasMore: stoppedEarly || leads.length === LEAD_SCAN_SIZE,
      nextCursor: lastScannedId,
    };
  }

  async listDrafts(
    organizationId: string,
    cursor?: string
  ): Promise<{ drafts: IWhatsAppDraft[]; nextCursor: string | null; hasMore: boolean }> {
    if (cursor && !mongoose.Types.ObjectId.isValid(cursor)) {
      throw AppError.badRequest('Invalid WhatsApp draft cursor');
    }
    const filter: Record<string, unknown> = { organizationId };
    if (cursor) filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    const page = (await WhatsAppDraftModel.find(filter)
      .sort({ _id: -1 })
      .limit(101)
      .select('-sourceKey -__v')
      .lean()) as unknown as IWhatsAppDraft[];
    const hasMore = page.length > 100;
    const drafts = page.slice(0, 100);
    return {
      drafts,
      nextCursor: hasMore ? drafts[drafts.length - 1]._id.toString() : null,
      hasMore,
    };
  }

  async rejectDraft(organizationId: string, draftId: string, userId: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(draftId)) throw AppError.badRequest('Invalid WhatsApp draft ID');
    const draft = await WhatsAppDraftModel.findOneAndUpdate(
      { _id: draftId, organizationId, status: 'PENDING_APPROVAL' },
      { $set: { status: 'REJECTED', approvedBy: userId, approvedAt: new Date() } },
      { new: true }
    );
    if (!draft) throw AppError.conflict('This draft is no longer waiting for approval');
  }

  async approveAndSend(
    organizationId: string,
    draftId: string,
    userId: string
  ): Promise<{ status: string; providerMessageId?: string }> {
    if (!mongoose.Types.ObjectId.isValid(draftId)) throw AppError.badRequest('Invalid WhatsApp draft ID');

    const draft = await WhatsAppDraftModel.findOneAndUpdate(
      { _id: draftId, organizationId, status: { $in: ['PENDING_APPROVAL', 'FAILED'] } },
      {
        $set: {
          status: 'SENDING',
          approvedBy: userId,
          approvedAt: new Date(),
        },
        $unset: { errorMessage: '' },
      },
      { new: true }
    );
    if (!draft) throw AppError.conflict('This draft is already being sent or is no longer approvable');

    let providerMessageId: string | undefined;
    try {
      const lead = await LeadModel.findOne({
        _id: draft.leadId,
        organizationId,
      }).select('_id leadId phone consent queries clearedInfo budget status');
      if (!lead || !isExplicitWhatsAppConsent(lead.consent as LeadRecord['consent'])) {
        throw AppError.forbidden('WhatsApp consent is missing, revoked, or no longer valid');
      }
      if (!validWhatsAppNumber(lead.phone) || lead.phone.trim() !== draft.recipientPhone) {
        throw AppError.conflict('The lead phone number changed or is not a valid international number');
      }

      const query = [...(lead.queries || [])]
        .filter((item) => item.status === 'OPEN' && item.text.trim())
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];
      const [paidInvoices] = await Promise.all([
        InvoiceModel.aggregate<{ paid: number }>([
          {
            $match: {
              organizationId,
              status: 'PAID',
              $or: [
                { leadId: { $in: [lead._id.toString(), lead.leadId] } },
                { manualPaymentLeadId: { $in: [lead._id.toString(), lead.leadId] } },
              ],
            },
          },
          { $group: { _id: null, paid: { $sum: '$amount' } } },
        ]),
      ]);
      const totalValue = lead.clearedInfo?.clearedAt
        ? Number(lead.clearedInfo.dealValue ?? lead.budget ?? 0)
        : 0;
      const currentOutstanding = Math.max(
        0,
        Number(
          (
            totalValue -
            Math.max(
              Number(lead.clearedInfo?.paymentTotalPaid || 0),
              Number(paidInvoices[0]?.paid || 0)
            )
          ).toFixed(2)
        )
      );
      if (
        sourceKey(lead._id.toString(), query?.id || '', currentOutstanding) !== draft.sourceKey ||
        (!query && currentOutstanding <= 0)
      ) {
        throw AppError.conflict('Lead query or payment balance changed; generate a fresh draft before sending');
      }

      providerMessageId = await this.sendMetaTemplate(draft.recipientPhone, draft.message);
      await WhatsAppDraftModel.updateOne(
        { _id: draft._id, organizationId, status: 'SENDING' },
        { $set: { status: 'SENT', sentAt: new Date(), providerMessageId } }
      );
      return { status: 'SENT', providerMessageId };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'WhatsApp message could not be sent';
      const deliveryUnknown =
        error instanceof WhatsAppDeliveryUnknownError || Boolean(providerMessageId);
      await WhatsAppDraftModel.updateOne(
        { _id: draft._id, organizationId, status: 'SENDING' },
        {
          $set: {
            status: deliveryUnknown ? 'SEND_UNKNOWN' : 'FAILED',
            errorMessage: message.slice(0, 500),
            ...(providerMessageId ? { providerMessageId } : {}),
          },
        }
      );
      throw error;
    }
  }

  private async sendMetaTemplate(phone: string, message: string): Promise<string> {
    if (
      !env.WHATSAPP_ACCESS_TOKEN ||
      !env.WHATSAPP_PHONE_NUMBER_ID ||
      !env.WHATSAPP_TEMPLATE_NAME ||
      !env.WHATSAPP_TEMPLATE_LANGUAGE
    ) {
      throw AppError.badRequest(
        'Meta WhatsApp is not configured. Set the access token, phone number ID, and approved template name/language on the backend.'
      );
    }

    let response: Response;
    try {
      response = await fetch(
        `https://graph.facebook.com/${env.WHATSAPP_GRAPH_API_VERSION || 'v23.0'}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: phone.replace(/\D/g, ''),
            type: 'template',
            template: {
              name: env.WHATSAPP_TEMPLATE_NAME,
              language: { code: env.WHATSAPP_TEMPLATE_LANGUAGE },
              components: [
                {
                  type: 'body',
                  parameters: [{ type: 'text', text: message }],
                },
              ],
            },
          }),
        }
      );
    } catch {
      throw new WhatsAppDeliveryUnknownError(
        'Meta delivery could not be confirmed. Check the WhatsApp provider before attempting another send.'
      );
    }

    let result: { messages?: Array<{ id?: string }>; error?: { message?: string } };
    try {
      result = (await response.json()) as typeof result;
    } catch {
      throw new WhatsAppDeliveryUnknownError(
        'Meta response could not be read. Check the WhatsApp provider before attempting another send.'
      );
    }
    if (!response.ok) {
      throw AppError.badRequest(
        `Meta WhatsApp send failed: ${result.error?.message || `HTTP ${response.status}`}`
      );
    }
    if (!result.messages?.[0]?.id) {
      throw new WhatsAppDeliveryUnknownError(
        'Meta accepted the request without a message ID. Verify provider delivery before retrying.'
      );
    }
    return result.messages[0].id;
  }
}

export const whatsAppAutomationService = new WhatsAppAutomationService();
