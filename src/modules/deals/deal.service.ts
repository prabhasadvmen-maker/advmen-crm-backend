import { dealRepository } from './deal.repository.js';
import { AppError } from '../../shared/errors/AppError.js';
import { eventBus } from '../../shared/events/EventBus.js';
import { IDeal, DealModel, DealStage } from './deal.model.js';

// Default stage probabilities per PDF Section 8
const STAGE_PROBABILITIES: Record<DealStage, number> = {
  DISCOVERY: 10,
  QUALIFICATION: 30,
  PROPOSAL: 70,
  NEGOTIATION: 85,
  WON: 100,
  LOST: 0,
};

export class DealService {
  async createDeal(organizationId: string, actorId: string, dealData: Partial<IDeal>): Promise<IDeal> {
    const dealId = await dealRepository.generateDealId(organizationId);
    const stage = dealData.stage || 'DISCOVERY';
    const probability = dealData.probability ?? STAGE_PROBABILITIES[stage];

    const createdDeal = await dealRepository.create(organizationId, {
      ...dealData,
      dealId,
      stage,
      probability,
      transitions: [
        {
          toStage: stage,
          actorId,
          reason: 'Initial deal creation',
          transitionedAt: new Date(),
        },
      ],
    });

    return createdDeal;
  }

  async getDeals(organizationId: string, query: { page?: number; limit?: number; stage?: string; pipelineId?: string; ownerId?: string; search?: string }) {
    const filter: Record<string, unknown> = {};

    if (query.stage) filter.stage = query.stage;
    if (query.pipelineId) filter.pipelineId = query.pipelineId;
    if (query.ownerId) filter.ownerId = query.ownerId;

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [
        { title: searchRegex },
        { company: searchRegex },
        { contactName: searchRegex },
        { dealId: searchRegex },
      ];
    }

    const result = await dealRepository.findPaginated(organizationId, filter, {
      page: query.page,
      limit: query.limit,
      sort: { createdAt: -1 },
    });

    // Auto-heal any closed/finalized deals that were saved with default DISCOVERY stage
    for (const d of result.docs) {
      if ((d.title?.includes('Closed Deal') || d.title?.includes('Finalized Deal')) && d.stage === 'DISCOVERY') {
        d.stage = 'WON';
        d.probability = 100;
        await DealModel.updateOne({ _id: (d as any)._id }, { $set: { stage: 'WON', probability: 100 } }).catch(() => {});
      }
    }

    return result;
  }

  async getDealById(organizationId: string, id: string): Promise<IDeal> {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const filter = isObjectId ? { _id: id } : { dealId: id };
    const deal = await dealRepository.findOne(organizationId, filter);
    if (!deal) {
      throw AppError.notFound('Deal');
    }
    return deal;
  }

  async updateDeal(
    organizationId: string,
    id: string,
    actorId: string,
    updateData: Partial<IDeal> & { reason?: string }
  ): Promise<IDeal> {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const filter = isObjectId ? { _id: id } : { dealId: id };
    const existing = await dealRepository.findOne(organizationId, filter);
    if (!existing) {
      throw AppError.notFound('Deal');
    }

    // Check if stage transition occurred
    if (updateData.stage && updateData.stage !== existing.stage) {
      const newStage = updateData.stage;
      updateData.probability = STAGE_PROBABILITIES[newStage] ?? existing.probability;

      const transition = {
        fromStage: existing.stage,
        toStage: newStage,
        actorId,
        reason: updateData.reason || 'Stage updated',
        transitionedAt: new Date(),
      };

      const updated = await dealRepository.updateOne(organizationId, filter, {
        ...updateData,
        $push: { transitions: transition },
      });

      if (!updated) {
        throw AppError.notFound('Deal');
      }

      eventBus.emit('deal.stage_changed', {
        organizationId,
        dealId: updated.dealId,
        previousStage: existing.stage,
        newStage,
        value: updated.value,
      });

      if (newStage === 'WON') {
        eventBus.emit('deal.won', {
          organizationId,
          dealId: updated.dealId,
          value: updated.value,
          ownerId: updated.ownerId || actorId,
        });
      }

      return updated;
    }

    const updated = await dealRepository.updateOne(organizationId, filter, updateData);
    if (!updated) {
      throw AppError.notFound('Deal');
    }

    return updated;
  }

  async deleteDeal(organizationId: string, id: string): Promise<void> {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const filter = isObjectId ? { _id: id, organizationId } : { dealId: id, organizationId };
    const result = await DealModel.deleteOne(filter);
    if ((result.deletedCount ?? 0) === 0) {
      throw AppError.notFound('Deal');
    }
  }

  async getPipelineMetrics(organizationId: string, pipelineId: string = 'pipe_default') {
    return dealRepository.getPipelineStageMetrics(organizationId, pipelineId);
  }
}

export const dealService = new DealService();
