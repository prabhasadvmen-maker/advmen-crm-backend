import { leadImportService } from '../../src/modules/leads/lead-import.service.js';

describe('LeadImportService distribution validation', () => {
  it('rejects a lead assigned to multiple employees in custom distribution', async () => {
    await expect(
      leadImportService.distributeCustom('org_test', [
        { employeeId: 'employee_1', leadIds: ['lead_1', 'lead_2'] },
        { employeeId: 'employee_2', leadIds: ['lead_2', 'lead_3'] },
      ])
    ).rejects.toThrow('Lead lead_2 is assigned more than once in this distribution.');
  });

  it('rejects duplicate lead IDs in one custom employee assignment', async () => {
    await expect(
      leadImportService.distributeCustom('org_test', [
        { employeeId: 'employee_1', leadIds: ['lead_1', 'lead_1'] },
      ])
    ).rejects.toThrow('Lead lead_1 is assigned more than once in this distribution.');
  });
});
