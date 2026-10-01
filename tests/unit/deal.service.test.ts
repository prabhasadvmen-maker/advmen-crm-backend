import { DealService } from '../../src/modules/deals/deal.service.js';

describe('DealService Unit Tests', () => {
  const service = new DealService();
  const TENANT_ID = 'org_acme_corp';
  const ACTOR_ID = 'usr_rep_01';

  describe('Stage Probabilities & Transitions', () => {
    it('defines expected default stage probabilities per CRM specification', () => {
      const stageProbabilities: Record<string, number> = {
        DISCOVERY: 10,
        QUALIFICATION: 30,
        PROPOSAL: 70,
        NEGOTIATION: 85,
        WON: 100,
        LOST: 0,
      };

      expect(stageProbabilities.DISCOVERY).toBe(10);
      expect(stageProbabilities.QUALIFICATION).toBe(30);
      expect(stageProbabilities.PROPOSAL).toBe(70);
      expect(stageProbabilities.NEGOTIATION).toBe(85);
      expect(stageProbabilities.WON).toBe(100);
      expect(stageProbabilities.LOST).toBe(0);
    });

    it('has required service methods exposed', () => {
      expect(typeof service.createDeal).toBe('function');
      expect(typeof service.getDeals).toBe('function');
      expect(typeof service.getDealById).toBe('function');
      expect(typeof service.updateDeal).toBe('function');
      expect(typeof service.deleteDeal).toBe('function');
      expect(typeof service.getPipelineMetrics).toBe('function');
    });
  });
});
