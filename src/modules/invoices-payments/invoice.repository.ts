import { BaseTenantRepository } from '../../shared/repository/BaseTenantRepository.js';
import { IInvoice, InvoiceModel } from './invoice.model.js';

export class InvoiceRepository extends BaseTenantRepository<IInvoice> {
  constructor() {
    super(InvoiceModel);
  }

  async generateInvoiceNumber(organizationId: string): Promise<{ invoiceId: string; invoiceNumber: string }> {
    const count = await this.model.countDocuments({ organizationId });
    const year = new Date().getFullYear();
    const invoiceNumber = `INV-${year}-${2001 + count}`;
    return { invoiceId: invoiceNumber, invoiceNumber };
  }

  async getRevenueMetrics(organizationId: string) {
    return this.model.aggregate([
      { $match: { organizationId } },
      {
        $group: {
          _id: '$status',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);
  }
}

export const invoiceRepository = new InvoiceRepository();
