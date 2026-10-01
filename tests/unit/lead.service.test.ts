import { LeadService } from '../../src/modules/leads/lead.service.js';

describe('LeadService Unit Tests', () => {
  const service = new LeadService();

  describe('Service Methods Gating', () => {
    it('exposes CRUD methods for lead intelligence', () => {
      expect(typeof service.createLead).toBe('function');
      expect(typeof service.getLeads).toBe('function');
      expect(typeof service.getLeadById).toBe('function');
      expect(typeof service.updateLead).toBe('function');
      expect(typeof service.deleteLead).toBe('function');
    });
  });
});
