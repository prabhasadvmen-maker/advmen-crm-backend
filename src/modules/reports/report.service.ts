import { DealModel, DealStage } from '../deals/deal.model.js';
import { InvoiceModel } from '../invoices-payments/invoice.model.js';

const DEAL_STAGES: DealStage[] = [
  'DISCOVERY',
  'QUALIFICATION',
  'PROPOSAL',
  'NEGOTIATION',
  'WON',
  'LOST',
];

interface CurrencyAmount {
  amount: number;
}

interface DealSummary {
  totalDeals: number;
  wonDeals: number;
  lostDeals: number;
  activeDeals: number;
  pipelineValue: number;
  wonRevenue: number;
}

interface DealStageMetric {
  stage: DealStage;
  count: number;
  value: number;
}

export class ReportService {
  async getOverview(organizationId: string) {
    const [dealMetrics, invoiceMetrics] = await Promise.all([
      DealModel.aggregate([
        { $match: { organizationId } },
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id: null,
                  totalDeals: { $sum: 1 },
                  wonDeals: { $sum: { $cond: [{ $eq: ['$stage', 'WON'] }, 1, 0] } },
                  lostDeals: { $sum: { $cond: [{ $eq: ['$stage', 'LOST'] }, 1, 0] } },
                  activeDeals: {
                    $sum: { $cond: [{ $not: [{ $in: ['$stage', ['WON', 'LOST']] }] }, 1, 0] },
                  },
                  pipelineValue: {
                    $sum: {
                      $cond: [
                        { $not: [{ $in: ['$stage', ['WON', 'LOST']] }] },
                        { $ifNull: ['$value', 0] },
                        0,
                      ],
                    },
                  },
                  wonRevenue: {
                    $sum: { $cond: [{ $eq: ['$stage', 'WON'] }, { $ifNull: ['$value', 0] }, 0] },
                  },
                },
              },
              { $sort: { _id: 1 } },
            ],
            stages: [
              {
                $group: {
                  _id: '$stage',
                  count: { $sum: 1 },
                  value: { $sum: { $ifNull: ['$value', 0] } },
                },
              },
              { $sort: { _id: 1 } },
              {
                $project: {
                  _id: 0,
                  stage: '$_id',
                  currency: { $literal: 'INR' },
                  count: 1,
                  value: 1,
                },
              },
            ],
            recentDeals: [
              { $sort: { updatedAt: -1, createdAt: -1 } },
              { $limit: 30 },
              {
                $project: {
                  _id: 0,
                  id: { $toString: '$_id' },
                  dealId: 1,
                  title: 1,
                  company: 1,
                  value: 1,
                  currency: { $literal: 'INR' },
                  stage: 1,
                  updatedAt: 1,
                },
              },
            ],
          },
        },
      ]),
      InvoiceModel.aggregate([
        { $match: { organizationId, status: 'PAID' } },
        {
          $group: {
            _id: null,
            amount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            currency: { $literal: 'INR' },
            amount: 1,
            count: 1,
          },
        },
      ]),
    ]);

    const dealData = dealMetrics[0] || {};
    const summary: Array<DealSummary & { currency: 'INR' }> = (dealData.summary || []).map((row: Record<string, unknown>) => ({
      currency: 'INR',
      totalDeals: Number(row.totalDeals || 0),
      wonDeals: Number(row.wonDeals || 0),
      lostDeals: Number(row.lostDeals || 0),
      activeDeals: Number(row.activeDeals || 0),
      pipelineValue: Number(row.pipelineValue || 0),
      wonRevenue: Number(row.wonRevenue || 0),
    }));
    const stages: Array<DealStageMetric & { currency: 'INR' }> = (dealData.stages || []).map(
      (row: Record<string, unknown>) => ({
        stage: row.stage as DealStage,
        currency: 'INR',
        count: Number(row.count || 0),
        value: Number(row.value || 0),
      })
    );
    const wonCount = summary.reduce((total, row) => total + row.wonDeals, 0);
    const lostCount = summary.reduce((total, row) => total + row.lostDeals, 0);
    const closedDeals = wonCount + lostCount;

    return {
      summary,
      stages: DEAL_STAGES.flatMap((stage) => stages.filter((metric) => metric.stage === stage)),
      collectedPayments: (invoiceMetrics as CurrencyAmount[]).map((row) => ({
        currency: 'INR',
        amount: Number(row.amount || 0),
      })),
      totals: {
        totalDeals: summary.reduce((total, row) => total + row.totalDeals, 0),
        activeDeals: summary.reduce((total, row) => total + row.activeDeals, 0),
        wonDeals: wonCount,
        lostDeals: lostCount,
        closedDeals,
        winRate: closedDeals ? Math.round((wonCount / closedDeals) * 100) : 0,
      },
      recentDeals: (dealData.recentDeals || []).map((deal: Record<string, unknown>) => ({
        id: String(deal.id || deal._id || ''),
        dealId: String(deal.dealId || ''),
        title: String(deal.title || 'Untitled deal'),
        company: String(deal.company || ''),
        value: Number(deal.value || 0),
        currency: 'INR',
        stage: deal.stage as DealStage,
        updatedAt: deal.updatedAt,
      })),
    };
  }
}

export const reportService = new ReportService();
