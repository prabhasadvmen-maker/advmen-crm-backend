import { callRepository } from './call.repository.js';
import { ICall } from './call.model.js';
import { eventBus } from '../../shared/events/EventBus.js';
import { AppError } from '../../shared/errors/AppError.js';
import { LeadModel } from '../leads/lead.model.js';

export class CallService {
  async logCall(
    organizationId: string,
    caller: { id: string; name: string },
    callData: Partial<ICall> & { leadId: string; leadPhone: string }
  ): Promise<ICall> {
    const callId = await callRepository.generateCallId(organizationId);

    const createdCall = await callRepository.create(organizationId, {
      ...callData,
      callId,
      userId: caller.id,
      callerName: caller.name,
      startedAt: callData.startedAt || new Date(),
      endedAt: callData.endedAt || new Date(),
    });

    // Update firstContactAt on lead if this was first call
    await LeadModel.updateOne(
      { organizationId, leadId: callData.leadId, firstContactAt: { $exists: false } },
      { $set: { firstContactAt: new Date() } }
    );

    // Emit call completed event
    eventBus.emit('call.completed', {
      organizationId,
      callId: createdCall.callId,
      leadId: createdCall.leadId,
      duration: createdCall.durationSeconds,
      disposition: createdCall.disposition,
    });

    return createdCall;
  }

  async getCalls(
    organizationId: string,
    query: {
      page?: number;
      limit?: number;
      userId?: string;
      leadId?: string;
      disposition?: string;
      status?: string;
    }
  ) {
    const filter: Record<string, unknown> = {};
    if (query.userId) filter.userId = query.userId;
    if (query.leadId) filter.leadId = query.leadId;
    if (query.disposition) filter.disposition = query.disposition;
    if (query.status) filter.status = query.status;

    return callRepository.findPaginated(organizationId, filter, {
      page: query.page,
      limit: query.limit,
      sort: { createdAt: -1 },
    });
  }

  async getCallMetrics(organizationId: string, userId?: string) {
    return callRepository.getTelecallerMetrics(organizationId, userId);
  }

  async getCallById(organizationId: string, id: string): Promise<ICall> {
    const call = await callRepository.findById(organizationId, id);
    if (!call) {
      throw AppError.notFound('Call record');
    }
    return call;
  }
}

export const callService = new CallService();
