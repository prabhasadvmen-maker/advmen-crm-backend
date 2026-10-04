import { jest } from '@jest/globals';
import { LeadService } from '../../src/modules/leads/lead.service.js';
import { LeadModel } from '../../src/modules/leads/lead.model.js';

describe('LeadService Unit Tests', () => {
  const service = new LeadService();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Service Methods Gating', () => {
    it('exposes CRUD methods for lead intelligence', () => {
      expect(typeof service.createLead).toBe('function');
      expect(typeof service.getLeads).toBe('function');
      expect(typeof service.getLeadById).toBe('function');
      expect(typeof service.updateLead).toBe('function');
      expect(typeof service.deleteLead).toBe('function');
    });
  });

  describe('lead deletion protections', () => {
    it('excludes protected leads from the bulk-delete count', async () => {
      (jest.spyOn(LeadModel, 'aggregate') as any).mockResolvedValue([]);
      (jest.spyOn(LeadModel, 'countDocuments') as any).mockResolvedValue(1);

      await expect(service.getBulkDeleteCount('org-1', { all: true })).resolves.toEqual({
        count: 0,
        protectedCount: 1,
      });
    });

    it('only deletes eligible leads and reports how many were protected', async () => {
      const eligibleId = '507f1f77bcf86cd799439011';
      (jest.spyOn(LeadModel, 'aggregate') as any).mockResolvedValue([{ _id: eligibleId }]);
      (jest.spyOn(LeadModel, 'countDocuments') as any).mockResolvedValue(2);
      const deleteMany = jest.spyOn(LeadModel, 'deleteMany') as any;
      deleteMany.mockResolvedValue({ deletedCount: 1 });

      await expect(service.bulkDeleteLeads('org-1', { all: true })).resolves.toEqual({
        deletedCount: 1,
        protectedCount: 1,
      });
      expect(deleteMany).toHaveBeenCalledWith({
        organizationId: 'org-1',
        _id: { $in: [eligibleId] },
        $expr: expect.any(Object),
      });
    });

    it('rejects an individual lead deletion when it is protected', async () => {
      (jest.spyOn(LeadModel, 'aggregate') as any).mockResolvedValue([]);
      (jest.spyOn(LeadModel, 'countDocuments') as any).mockResolvedValue(1);

      await expect(service.deleteLead('org-1', 'LD-10001')).rejects.toThrow(
        'query history or an outstanding payment balance'
      );
    });
  });
});
