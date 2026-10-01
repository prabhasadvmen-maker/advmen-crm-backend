import mongoose, { Schema, Document } from 'mongoose';

export type AutomationTrigger =
  | 'lead.created'
  | 'lead.status_changed'
  | 'lead.score_updated'
  | 'task.created'
  | 'deal.stage_changed'
  | 'deal.won'
  | 'payment.received';

export type AutomationActionType =
  | 'ASSIGN_USER'
  | 'CREATE_TASK'
  | 'UPDATE_FIELD'
  | 'SEND_TEMPLATE'
  | 'NOTIFY_USER'
  | 'START_AI_SUMMARY';

export interface IAutomationCondition {
  field: string; // e.g. 'score', 'status', 'value'
  operator: 'EQUALS' | 'NOT_EQUALS' | 'GREATER_THAN' | 'LESS_THAN' | 'IN' | 'CONTAINS';
  value: unknown;
}

export interface IAutomationAction {
  type: AutomationActionType;
  config: Record<string, unknown>;
}

export interface IAutomation extends Document {
  automationId: string;
  organizationId: string;
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  conditions: IAutomationCondition[];
  actions: IAutomationAction[];
  isActive: boolean;
  executionCount: number;
  lastExecutedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AutomationSchema = new Schema<IAutomation>(
  {
    automationId: {
      type: String,
      required: true,
      index: true,
    },
    organizationId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
    trigger: {
      type: String,
      required: true,
      index: true,
    },
    conditions: [
      {
        field: { type: String, required: true },
        operator: {
          type: String,
          enum: ['EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'LESS_THAN', 'IN', 'CONTAINS'],
          required: true,
        },
        value: { type: Schema.Types.Mixed, required: true },
      },
    ],
    actions: [
      {
        type: {
          type: String,
          enum: [
            'ASSIGN_USER',
            'CREATE_TASK',
            'UPDATE_FIELD',
            'SEND_TEMPLATE',
            'NOTIFY_USER',
            'START_AI_SUMMARY',
          ],
          required: true,
        },
        config: { type: Schema.Types.Mixed, default: {} },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    executionCount: {
      type: Number,
      default: 0,
    },
    lastExecutedAt: Date,
  },
  {
    timestamps: true,
  }
);

AutomationSchema.index({ organizationId: 1, trigger: 1, isActive: 1 });

export const AutomationModel = mongoose.model<IAutomation>('Automation', AutomationSchema);
