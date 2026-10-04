import { jest } from '@jest/globals';
import { DealModel } from '../../src/modules/deals/deal.model.js';
import { InvoiceModel } from '../../src/modules/invoices-payments/invoice.model.js';
import { ReportService } from '../../src/modules/reports/report.service.js';

describe('ReportService', () => {
  const service = new ReportService();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds report metrics from organization-scoped deal and paid-invoice aggregates', async () => {
    const dealAggregate = jest.spyOn(DealModel, 'aggregate') as any;
    const invoiceAggregate = jest.spyOn(InvoiceModel, 'aggregate') as any;
    dealAggregate.mockResolvedValue([{
      summary: [{
        _id: 'USD',
        totalDeals: 3,
        wonDeals: 1,
        lostDeals: 1,
        activeDeals: 1,
        pipelineValue: 2000,
        wonRevenue: 5000,
      }],
      stages: [{
        stage: 'WON',
        currency: 'USD',
        count: 1,
        value: 5000,
      }],
      recentDeals: [{
        id: 'deal-1',
        dealId: 'DL-1001',
        title: 'CRM Renewal',
        company: 'Acme',
        value: 5000,
        currency: 'USD',
        stage: 'WON',
        updatedAt: new Date('2026-10-01T00:00:00.000Z'),
      }],
    }]);
    invoiceAggregate.mockResolvedValue([{ currency: 'INR', amount: 2500, count: 2 }]);

    const result = await service.getOverview('org-1');

    expect(dealAggregate).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ $match: { organizationId: 'org-1' } }),
    ]));
    const dealPipeline = dealAggregate.mock.calls[0][0] as Array<Record<string, any>>;
    const summaryGroup = (dealPipeline[1].$facet as any).summary[0].$group;
    expect(JSON.stringify(summaryGroup)).not.toContain('$nin');
    expect(JSON.stringify(summaryGroup)).toContain('$in');
    expect(invoiceAggregate).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ $match: { organizationId: 'org-1', status: 'PAID' } }),
    ]));
    expect(result.totals).toEqual({
      totalDeals: 3,
      activeDeals: 1,
      wonDeals: 1,
      lostDeals: 1,
      closedDeals: 2,
      winRate: 50,
    });
    expect(result.collectedPayments).toEqual([{ currency: 'INR', amount: 2500 }]);
    expect(result.summary[0].currency).toBe('INR');
    expect(result.stages[0].currency).toBe('INR');
    expect(result.recentDeals[0].title).toBe('CRM Renewal');
    expect(result.recentDeals[0].currency).toBe('INR');
  });

  it('returns zero metrics when the organization has no deals or paid invoices', async () => {
    (jest.spyOn(DealModel, 'aggregate') as any).mockResolvedValue([{
      summary: [],
      stages: [],
      recentDeals: [],
    }]);
    (jest.spyOn(InvoiceModel, 'aggregate') as any).mockResolvedValue([]);

    const result = await service.getOverview('org-empty');

    expect(result.totals).toEqual({
      totalDeals: 0,
      activeDeals: 0,
      wonDeals: 0,
      lostDeals: 0,
      closedDeals: 0,
      winRate: 0,
    });
    expect(result.stages).toEqual([]);
    expect(result.recentDeals).toEqual([]);
  });
});
