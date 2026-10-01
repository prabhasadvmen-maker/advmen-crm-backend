import { BaseTenantRepository } from '../../shared/repository/BaseTenantRepository.js';
import { IDeal, DealModel } from './deal.model.js';

export class DealRepository extends BaseTenantRepository<IDeal> {
  constructor() {
    super(DealModel);
  }

  /**
   * Get next auto-incrementing human-readable dealId (e.g. DL-2001)
   */
  async generateDealId(organizationId: string): Promise<string> {
    const count = await this.model.countDocuments({ organizationId });
    return `DL-${2001 + count}`;
  }

  /**
   * Aggregate pipeline metrics: count and total value per stage
   */
  async getPipelineStageMetrics(organizationId: string, pipelineId: string = 'pipe_default') {
    return this.model.aggregate([
      { $match: { organizationId, pipelineId } },
      {
        $group: {
          _id: '$stage',
          count: { $sum: 1 },
          totalValue: { $sum: '$value' },
          weightedValue: { $sum: { $multiply: ['$value', { $divide: ['$probability', 100] }] } },
        },
      },
    ]);
  }
}

export const dealRepository = new DealRepository();
