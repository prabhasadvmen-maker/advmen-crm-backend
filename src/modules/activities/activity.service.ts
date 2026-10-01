import { BaseTenantRepository } from '../../shared/repository/BaseTenantRepository.js';
import { IActivity, ActivityModel } from './activity.model.js';
import { v4 as uuidv4 } from 'uuid';
import { eventBus } from '../../shared/events/EventBus.js';

export class ActivityRepository extends BaseTenantRepository<IActivity> {
  constructor() {
    super(ActivityModel);
  }

  async getRecordTimeline(organizationId: string, recordId: string, limit: number = 50) {
    return this.model
      .find({
        organizationId,
        'relatedRecord.id': recordId,
      })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  }

  async getRecentActivities(organizationId: string, limit: number = 30) {
    return this.model
      .find({ organizationId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  }
}

export const activityRepository = new ActivityRepository();

export class ActivityService {
  constructor() {
    this.registerEventListeners();
  }

  /**
   * Listen to domain events across the system and automatically append to unified timeline
   */
  private registerEventListeners(): void {
    // 1. Lead Created
    eventBus.on('lead.created', async (payload) => {
      await this.logActivity(payload.organizationId, {
        type: 'LEAD_CREATED',
        title: 'New Lead Captured',
        description: `Lead [${payload.leadId}] captured from ${payload.source} with initial score of ${payload.score}.`,
        actorName: 'Lead Routing Engine',
        relatedRecord: { type: 'LEAD', id: payload.leadId, name: payload.leadId },
      });
    });

    // 2. Lead Status Changed
    eventBus.on('lead.status_changed', async (payload) => {
      await this.logActivity(payload.organizationId, {
        type: 'STAGE_CHANGE',
        title: 'Lead Status Updated',
        description: `Status changed from ${payload.previousStatus} to ${payload.newStatus}.`,
        actorName: 'Sales System',
        relatedRecord: { type: 'LEAD', id: payload.leadId, name: payload.leadId },
      });
    });

    // 3. Call Completed
    eventBus.on('call.completed', async (payload) => {
      await this.logActivity(payload.organizationId, {
        type: 'CALL',
        title: 'Outbound Call Logged',
        description: `Call duration: ${payload.duration}s. Disposition: ${payload.disposition || 'Completed'}.`,
        actorName: 'Telephony System',
        relatedRecord: { type: 'LEAD', id: payload.leadId, name: payload.leadId },
        metadata: { callId: payload.callId },
      });
    });

    // 4. Deal Won
    eventBus.on('deal.won', async (payload) => {
      await this.logActivity(payload.organizationId, {
        type: 'STAGE_CHANGE',
        title: '🎉 Deal Closed Won',
        description: `Deal [${payload.dealId}] closed won with value of $${payload.value.toLocaleString()}.`,
        actorName: 'Revenue Operations',
        relatedRecord: { type: 'DEAL', id: payload.dealId, name: payload.dealId },
      });
    });

    // 5. Payment Received
    eventBus.on('payment.received', async (payload) => {
      await this.logActivity(payload.organizationId, {
        type: 'PAYMENT',
        title: '💰 Payment Verified',
        description: `Payment of $${payload.amount.toLocaleString()} verified against Invoice [${payload.invoiceId}].`,
        actorName: 'Payment Gateway',
        relatedRecord: { type: 'INVOICE', id: payload.invoiceId, name: payload.invoiceId },
      });
    });
  }

  async logActivity(
    organizationId: string,
    data: {
      type: IActivity['type'];
      title: string;
      description: string;
      actorId?: string;
      actorName?: string;
      actorAvatar?: string;
      relatedRecord: IActivity['relatedRecord'];
      metadata?: Record<string, unknown>;
    }
  ): Promise<IActivity> {
    const activityId = `act_${uuidv4().replace(/-/g, '').slice(0, 12)}`;

    return activityRepository.create(organizationId, {
      ...data,
      activityId,
      actorName: data.actorName || 'System',
      timestamp: new Date(),
    });
  }

  async getTimeline(organizationId: string, recordId: string) {
    return activityRepository.getRecordTimeline(organizationId, recordId);
  }

  async getRecentActivities(organizationId: string, limit: number = 30) {
    return activityRepository.getRecentActivities(organizationId, limit);
  }
}

export const activityService = new ActivityService();
