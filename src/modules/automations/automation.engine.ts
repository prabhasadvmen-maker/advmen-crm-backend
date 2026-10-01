import { AutomationModel, IAutomation, IAutomationCondition } from './automation.model.js';
import { eventBus, EventKey } from '../../shared/events/EventBus.js';
import { taskService } from '../tasks/task.service.js';
import { leadRepository } from '../leads/lead.repository.js';
import { aiService } from '../ai/ai.service.js';

export class AutomationEngine {
  constructor() {
    this.registerTriggerListeners();
  }

  private registerTriggerListeners(): void {
    const supportedTriggers: EventKey[] = [
      'lead.created',
      'lead.status_changed',
      'lead.score_updated',
      'task.created',
      'deal.stage_changed',
      'deal.won',
      'payment.received',
    ];

    supportedTriggers.forEach((trigger) => {
      eventBus.on(trigger, async (payload: { organizationId: string; [key: string]: unknown }) => {
        await this.evaluateAndExecute(trigger, payload);
      });
    });
  }

  private matchCondition(condition: IAutomationCondition, payload: Record<string, unknown>): boolean {
    const payloadValue = payload[condition.field];

    switch (condition.operator) {
      case 'EQUALS':
        return payloadValue === condition.value;
      case 'NOT_EQUALS':
        return payloadValue !== condition.value;
      case 'GREATER_THAN':
        return Number(payloadValue) > Number(condition.value);
      case 'LESS_THAN':
        return Number(payloadValue) < Number(condition.value);
      case 'IN':
        return Array.isArray(condition.value) && condition.value.includes(payloadValue);
      case 'CONTAINS':
        return String(payloadValue).toLowerCase().includes(String(condition.value).toLowerCase());
      default:
        return false;
    }
  }

  async evaluateAndExecute(trigger: string, payload: { organizationId: string; [key: string]: unknown }): Promise<void> {
    const automations = (await AutomationModel.find({
      organizationId: payload.organizationId,
      trigger,
      isActive: true,
    }).lean()) as unknown as IAutomation[];


    for (const automation of automations) {
      const allConditionsMet = automation.conditions.every((cond) =>
        this.matchCondition(cond, payload)
      );

      if (allConditionsMet) {
        await this.executeActions(automation, payload);
      }
    }
  }

  private async executeActions(automation: IAutomation, payload: Record<string, unknown>): Promise<void> {
    for (const action of automation.actions) {
      try {
        switch (action.type) {
          case 'CREATE_TASK':
            await taskService.createTask(
              automation.organizationId,
              { id: 'system_automation', name: 'Automation Bot' },
              {
                title: (action.config.title as string) || `Follow-up on ${automation.name}`,
                dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
                priority: (action.config.priority as never) || 'HIGH',
                relatedTo: {
                  type: 'LEAD',
                  id: String(payload.leadId || payload.id || 'record'),
                  name: String(payload.leadId || 'Automated Task'),
                },
              }
            );
            break;

          case 'UPDATE_FIELD':
            if (payload.leadId && action.config.status) {
              await leadRepository.updateById(
                automation.organizationId,
                String(payload.leadId),
                { status: String(action.config.status) }
              );
            }
            break;

          case 'START_AI_SUMMARY':
            if (payload.leadId) {
              await aiService.generateLeadSummary(
                automation.organizationId,
                'system_bot',
                String(payload.leadId)
              );
            }
            break;

          default:
            console.log(`ℹ️ [Automation Action] ${action.type} handled for ${automation.name}`);
        }
      } catch (err) {
        console.error(`❌ [Automation Error] Failed executing action ${action.type} in ${automation.name}:`, err);
      }
    }

    // Increment execution count
    await AutomationModel.updateOne(
      { _id: automation._id },
      { $inc: { executionCount: 1 }, $set: { lastExecutedAt: new Date() } }
    );
  }
}

export const automationEngine = new AutomationEngine();
