import { BaseTenantRepository } from '../../shared/repository/BaseTenantRepository.js';
import { IAutomation, AutomationModel } from './automation.model.js';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../../shared/errors/AppError.js';

export class AutomationRepository extends BaseTenantRepository<IAutomation> {
  constructor() {
    super(AutomationModel);
  }
}

export const automationRepository = new AutomationRepository();

export class AutomationService {
  async createAutomation(organizationId: string, data: Partial<IAutomation>): Promise<IAutomation> {
    const automationId = `auto_${uuidv4().replace(/-/g, '').slice(0, 10)}`;

    return automationRepository.create(organizationId, {
      ...data,
      automationId,
      isActive: data.isActive ?? true,
      executionCount: 0,
    });
  }

  async getAutomations(organizationId: string, query: { page?: number; limit?: number }) {
    return automationRepository.findPaginated(organizationId, {}, {
      page: query.page,
      limit: query.limit,
      sort: { createdAt: -1 },
    });
  }

  async toggleAutomation(organizationId: string, id: string, isActive: boolean): Promise<IAutomation> {
    const updated = await automationRepository.updateById(organizationId, id, { isActive });
    if (!updated) {
      throw AppError.notFound('Automation workflow');
    }
    return updated;
  }

  async deleteAutomation(organizationId: string, id: string): Promise<void> {
    const deleted = await automationRepository.deleteById(organizationId, id);
    if (!deleted) {
      throw AppError.notFound('Automation workflow');
    }
  }
}

export const automationService = new AutomationService();
