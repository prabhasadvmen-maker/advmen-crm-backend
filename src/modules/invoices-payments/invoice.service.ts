import { invoiceRepository } from './invoice.repository.js';
import { IInvoice, InvoiceModel } from './invoice.model.js';
import { AppError } from '../../shared/errors/AppError.js';
import { eventBus } from '../../shared/events/EventBus.js';
import { LeadModel } from '../leads/lead.model.js';
import mongoose from 'mongoose';

export class InvoiceService {
  async recordFinalizedLeadPayment(
    organizationId: string,
    leadId: string,
    amount: number
  ): Promise<IInvoice> {
    const leadFilter = mongoose.Types.ObjectId.isValid(leadId)
      ? { _id: leadId, organizationId }
      : { leadId, organizationId };
    const lead = await LeadModel.findOne(leadFilter);
    if (!lead) throw AppError.notFound('Lead');
    if (!lead.clearedInfo?.clearedAt) {
      throw AppError.badRequest('Only completed leads can have a payment recorded.');
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw AppError.badRequest('Received amount must be greater than zero.');
    }

    const totalAmount = lead.clearedInfo.dealValue ?? lead.budget ?? 0;
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      throw AppError.badRequest('Set a valid final deal amount before recording payment.');
    }

    const legacyPayments = await InvoiceModel.aggregate<{ totalPaid: number }>([
      {
        $match: {
          organizationId,
          leadId: lead._id.toString(),
          status: 'PAID',
        },
      },
      { $group: { _id: null, totalPaid: { $sum: '$amount' } } },
    ]);
    const recordedTotal = Math.max(
      lead.clearedInfo.paymentTotalPaid || 0,
      legacyPayments[0]?.totalPaid || 0
    );
    const pendingAmount = Math.max(0, totalAmount - recordedTotal);
    if (amount > pendingAmount) {
      throw AppError.badRequest(
        `Amount exceeds the remaining balance of ₹${pendingAmount.toLocaleString('en-IN')}.`
      );
    }

    await LeadModel.updateOne(
      { _id: lead._id, organizationId },
      { $max: { 'clearedInfo.paymentTotalPaid': recordedTotal } }
    );

    const reservedLead = await LeadModel.findOneAndUpdate(
      {
        _id: lead._id,
        organizationId,
        $expr: {
          $lte: [
            { $add: [{ $ifNull: ['$clearedInfo.paymentTotalPaid', 0] }, amount] },
            totalAmount,
          ],
        },
      },
      { $inc: { 'clearedInfo.paymentTotalPaid': amount } },
      { new: true }
    );
    if (!reservedLead) {
      const currentLead = await LeadModel.findOne({ _id: lead._id, organizationId }).lean();
      const currentPaid = currentLead?.clearedInfo?.paymentTotalPaid || recordedTotal;
      const remaining = Math.max(0, totalAmount - currentPaid);
      throw AppError.conflict(
        `Payment balance changed. The remaining amount is ₹${remaining.toLocaleString('en-IN')}.`
      );
    }

    const paidAt = new Date();
    let payment: IInvoice;
    try {
      const { invoiceId, invoiceNumber } = await invoiceRepository.generateInvoiceNumber(organizationId);
      payment = await InvoiceModel.create({
        invoiceId,
        invoiceNumber,
        organizationId,
        leadId: lead._id.toString(),
        dealId: lead.clearedInfo.dealId,
        company: lead.company || lead.name,
        recipientEmail: lead.email || '',
        amount,
        currency: 'INR',
        status: 'PAID',
        dueDate: paidAt,
        paidAt,
        paymentProvider: 'MANUAL',
        paymentId: `MANUAL-${lead._id.toString()}-${new mongoose.Types.ObjectId().toString()}`,
        idempotencyKey: `lead-payment:${organizationId}:${lead._id.toString()}:${new mongoose.Types.ObjectId().toString()}`,
      });

    } catch (error) {
      await LeadModel.updateOne(
        { _id: lead._id, organizationId },
        { $inc: { 'clearedInfo.paymentTotalPaid': -amount } }
      );
      throw error;
    }

    await LeadModel.updateOne(
      { _id: lead._id, organizationId },
      {
        $set: {
          'clearedInfo.paymentInvoiceId': payment.invoiceId,
          'clearedInfo.paymentRecordedAt': paidAt,
        },
      }
    );

    eventBus.emit('payment.received', {
      organizationId,
      invoiceId: payment.invoiceId,
      amount: payment.amount,
      paymentId: payment.paymentId || '',
    });

    return payment;
  }

  async createInvoice(organizationId: string, data: Partial<IInvoice>): Promise<IInvoice> {
    const { invoiceId, invoiceNumber } = await invoiceRepository.generateInvoiceNumber(organizationId);

    const invoice = await invoiceRepository.create(organizationId, {
      ...data,
      invoiceId,
      invoiceNumber,
      status: 'SENT',
    });

    return invoice;
  }

  async getInvoices(organizationId: string, query: { page?: number; limit?: number; status?: string }) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;

    return invoiceRepository.findPaginated(organizationId, filter, {
      page: query.page,
      limit: query.limit,
      sort: { createdAt: -1 },
    });
  }

  async getInvoiceById(organizationId: string, id: string): Promise<IInvoice> {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const filter = isObjectId ? { _id: id } : { invoiceId: id };
    const invoice = await invoiceRepository.findOne(organizationId, filter);
    if (!invoice) {
      throw AppError.notFound('Invoice');
    }
    return invoice;
  }

  /**
   * Idempotent payment recording
   */
  async recordPayment(
    organizationId: string,
    id: string,
    paymentData: { paymentId: string; paymentProvider?: string; idempotencyKey: string }
  ): Promise<IInvoice> {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const filter = isObjectId ? { _id: id } : { invoiceId: id };
    const invoice = await invoiceRepository.findOne(organizationId, filter);
    if (!invoice) {
      throw AppError.notFound('Invoice');
    }

    // Idempotency check: If already paid with this idempotency key, return existing state safely
    if (invoice.status === 'PAID' && invoice.idempotencyKey === paymentData.idempotencyKey) {
      return invoice;
    }

    if (invoice.status === 'PAID') {
      throw AppError.conflict('Invoice has already been paid');
    }

    const updated = await invoiceRepository.updateOne(organizationId, filter, {
      status: 'PAID',
      paidAt: new Date(),
      paymentId: paymentData.paymentId,
      paymentProvider: paymentData.paymentProvider || 'stripe',
      idempotencyKey: paymentData.idempotencyKey,
    });

    if (!updated) {
      throw AppError.notFound('Invoice');
    }

    eventBus.emit('payment.received', {
      organizationId,
      invoiceId: updated.invoiceId,
      amount: updated.amount,
      paymentId: paymentData.paymentId,
    });

    if (updated.recipientEmail) {
      import('../../shared/services/email.service.js').then(({ emailService }) => {
        emailService.sendPaymentReceiptEmail(updated.recipientEmail, updated.invoiceNumber, updated.amount);
      }).catch(() => {});
    }

    return updated;
  }

  async deleteInvoice(organizationId: string, id: string): Promise<void> {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const filter = isObjectId ? { _id: id, organizationId } : { invoiceId: id, organizationId };
    const result = await InvoiceModel.deleteOne(filter);
    if ((result.deletedCount ?? 0) === 0) {
      throw AppError.notFound('Invoice');
    }
  }

  async getRevenueMetrics(organizationId: string) {
    return invoiceRepository.getRevenueMetrics(organizationId);
  }
}

export const invoiceService = new InvoiceService();
