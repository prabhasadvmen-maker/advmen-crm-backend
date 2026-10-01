import { BaseTenantRepository } from '../../shared/repository/BaseTenantRepository.js';
import { ICall, CallModel } from './call.model.js';

export class CallRepository extends BaseTenantRepository<ICall> {
  constructor() {
    super(CallModel);
  }

  async generateCallId(organizationId: string): Promise<string> {
    const count = await this.model.countDocuments({ organizationId });
    return `CALL-${50001 + count}`;
  }

  async getTelecallerMetrics(organizationId: string, userId?: string) {
    const match: Record<string, unknown> = { organizationId };
    if (userId) match.userId = userId;

    return this.model.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$disposition',
          totalCalls: { $sum: 1 },
          totalDuration: { $sum: '$durationSeconds' },
          connectedCalls: {
            $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] },
          },
        },
      },
    ]);
  }
}

export const callRepository = new CallRepository();
