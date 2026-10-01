import { invoiceRepository } from './invoice.repository.js';
import { IInvoice, InvoiceModel } from './invoice.model.js';
import { AppError } from '../../shared/errors/AppError.js';
import { eventBus } from '../../shared/events/EventBus.js';

export class InvoiceService {
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
