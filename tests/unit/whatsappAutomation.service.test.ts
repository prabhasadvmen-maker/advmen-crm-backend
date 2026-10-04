import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { AiGateway } from '../../src/modules/ai/ai.gateway.js';
import { WhatsAppAutomationService } from '../../src/modules/ai/whatsappAutomation.service.js';
import { WhatsAppDraftModel } from '../../src/modules/ai/whatsappDraft.model.js';
import { InvoiceModel } from '../../src/modules/invoices-payments/invoice.model.js';
import { LeadModel } from '../../src/modules/leads/lead.model.js';

describe('WhatsAppAutomationService', () => {
  const service = new WhatsAppAutomationService();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockLeadScan(lead: Record<string, unknown>) {
    jest.spyOn(LeadModel, 'find').mockReturnValue({
      select: () => ({
        sort: () => ({
          limit: () => ({ lean: async () => [lead] }),
        }),
      }),
    } as never);
    (jest.spyOn(InvoiceModel, 'aggregate') as any).mockResolvedValue([]);
  }

  it('does not create drafts for web-form consent even when the status is granted', async () => {
    mockLeadScan({
      _id: new mongoose.Types.ObjectId(),
      leadId: 'LEAD-1',
      name: 'Lead One',
      phone: '+14155550123',
      consent: {
        channel: 'WEB_FORM',
        status: 'GRANTED',
        evidence: 'Form submission',
      },
      queries: [{ id: 'query-1', text: 'Need help with the proposal', status: 'OPEN', createdAt: new Date() }],
    });
    const aiExecute = jest.spyOn(AiGateway, 'execute');
    const draftCreate = jest.spyOn(WhatsAppDraftModel, 'create');

    const result = await service.generateNextDraftBatch('org-1', 'admin-1');

    expect(result.created).toBe(0);
    expect(aiExecute).not.toHaveBeenCalled();
    expect(draftCreate).not.toHaveBeenCalled();
    expect((LeadModel.find as jest.Mock).mock.calls[0][0]).toMatchObject({
      organizationId: 'org-1',
      'consent.channel': 'WHATSAPP',
      'consent.status': 'GRANTED',
    });
  });

  it('creates a pending draft with the exact database balance appended outside AI output', async () => {
    mockLeadScan({
      _id: new mongoose.Types.ObjectId(),
      leadId: 'LEAD-2',
      name: 'Lead Two',
      phone: '+14155550124',
      consent: {
        channel: 'WHATSAPP',
        status: 'GRANTED',
        evidence: 'Opt-in received on 2026-10-01',
      },
      queries: [{ id: 'query-2', text: 'Please clarify the service terms', status: 'OPEN', createdAt: new Date() }],
      clearedInfo: {
        clearedAt: new Date(),
        dealValue: 12000,
        paymentTotalPaid: 2500,
      },
    });
    (jest.spyOn(WhatsAppDraftModel, 'exists') as any).mockResolvedValue(null);
    (jest.spyOn(WhatsAppDraftModel, 'create') as any).mockResolvedValue({});
    const aiExecute = jest.spyOn(AiGateway, 'execute') as any;
    aiExecute.mockResolvedValue({
      output: 'Could you share a convenient time to discuss this?',
      provider: 'gemini',
    });

    const result = await service.generateNextDraftBatch('org-1', 'admin-1');

    expect(result.created).toBe(1);
    expect(aiExecute.mock.calls[0][0].prompt).not.toContain('Please clarify the service terms');
    expect(aiExecute.mock.calls[0][0].prompt).toContain('Customer follow-up topic category: general follow-up');
    expect(WhatsAppDraftModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'PENDING_APPROVAL',
        outstandingAmount: 9500,
        message: expect.stringContaining('₹9,500'),
      })
    );
  });

  it('revalidates consent before an administrator can send a saved draft', async () => {
    const draft = {
      _id: new mongoose.Types.ObjectId(),
      leadId: new mongoose.Types.ObjectId().toString(),
      sourceKey: 'draft-key',
      recipientPhone: '+14155550125',
      message: 'Follow up',
    };
    (jest.spyOn(WhatsAppDraftModel, 'findOneAndUpdate') as any).mockResolvedValue(draft);
    jest.spyOn(WhatsAppDraftModel, 'updateOne').mockResolvedValue({} as never);
    jest.spyOn(LeadModel, 'findOne').mockReturnValue({
      select: async () => ({
        ...draft,
        leadId: 'LEAD-3',
        phone: '+14155550125',
        consent: { channel: 'WHATSAPP', status: 'REVOKED', evidence: 'Previously opted in' },
      }),
    } as never);

    await expect(
      service.approveAndSend('org-1', draft._id.toString(), 'admin-1')
    ).rejects.toHaveProperty('statusCode', 403);
    expect(WhatsAppDraftModel.updateOne).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ $set: expect.objectContaining({ status: 'FAILED' }) })
    );
  });
});
