import { BaseTenantRepository } from '../../shared/repository/BaseTenantRepository.js';
import { IInvoice, InvoiceModel } from './invoice.model.js';
import { LeadModel } from '../leads/lead.model.js';

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
    const groups = await this.model.aggregate([
      { $match: { organizationId } },
      {
        $group: {
          _id: '$status',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);
    const finalizedLeads = await LeadModel.find({
      organizationId,
      $or: [
        { 'clearedInfo.clearedAt': { $exists: true } },
        { status: { $in: ['WON', 'CONVERTED'] } },
      ],
    })
      .select('leadId clearedInfo.dealValue clearedInfo.paymentTotalPaid budget')
      .lean();
    const finalizedLeadIds = finalizedLeads.map((lead) => lead._id.toString());
    const paymentsByLead = finalizedLeadIds.length
      ? await this.model.aggregate([
          {
            $match: {
              organizationId,
              leadId: { $in: finalizedLeadIds },
              status: 'PAID',
            },
          },
          { $group: { _id: '$leadId', amount: { $sum: '$amount' } } },
        ])
      : [];
    const pendingInvoicesByLead = finalizedLeadIds.length
      ? await this.model.aggregate([
          {
            $match: {
              organizationId,
              leadId: { $in: finalizedLeadIds },
              status: { $in: ['SENT', 'OVERDUE'] },
            },
          },
          {
            $group: {
              _id: '$leadId',
              amount: { $sum: '$amount' },
              count: { $sum: 1 },
            },
          },
        ])
      : [];
    const paidByLeadId = new Map(paymentsByLead.map((payment) => [payment._id, payment.amount]));
    const pendingInvoiceByLeadId = new Map(
      pendingInvoicesByLead.map((invoice) => [invoice._id, invoice])
    );

    const totals = {
      totalRevenue: 0,
      paidCount: 0,
      pendingAmount: 0,
      pendingCount: 0,
      overdueAmount: 0,
      overdueCount: 0,
      totalInvoices: 0,
    };

    for (const group of groups) {
      totals.totalInvoices += group.count;
      if (group._id === 'PAID') {
        totals.totalRevenue = group.totalAmount;
        totals.paidCount = group.count;
      } else if (group._id === 'SENT') {
        totals.pendingAmount += group.totalAmount;
        totals.pendingCount += group.count;
      } else if (group._id === 'OVERDUE') {
        totals.pendingAmount += group.totalAmount;
        totals.pendingCount += group.count;
        totals.overdueAmount = group.totalAmount;
        totals.overdueCount = group.count;
      }
    }

    for (const lead of finalizedLeads) {
      const totalAmount = lead.clearedInfo?.dealValue ?? lead.budget ?? 0;
      if (!Number.isFinite(totalAmount) || totalAmount <= 0) continue;

      const leadId = lead._id.toString();
      const linkedPendingInvoices = pendingInvoiceByLeadId.get(leadId);
      if (linkedPendingInvoices) {
        totals.pendingAmount -= linkedPendingInvoices.amount;
        totals.pendingCount -= linkedPendingInvoices.count;
      }

      const invoicePaid = paidByLeadId.get(leadId) || 0;
      const recordedPaid = Math.max(lead.clearedInfo?.paymentTotalPaid || 0, invoicePaid);
      const remaining = Math.max(0, totalAmount - recordedPaid);
      if (remaining > 0) {
        totals.pendingAmount += remaining;
        totals.pendingCount += 1;
      }
    }

    return totals;
  }
}

export const invoiceRepository = new InvoiceRepository();
