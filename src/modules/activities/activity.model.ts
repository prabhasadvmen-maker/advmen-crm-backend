import mongoose, { Schema, Document } from 'mongoose';

export type ActivityType =
  | 'LEAD_CREATED'
  | 'CALL'
  | 'EMAIL'
  | 'WHATSAPP'
  | 'STAGE_CHANGE'
  | 'NOTE'
  | 'TASK'
  | 'MEETING'
  | 'PROPOSAL'
  | 'PAYMENT'
  | 'AI_INSIGHT';

export interface IActivity extends Document {
  activityId: string;
  organizationId: string;
  type: ActivityType;
  title: string;
  description: string;
  actorId?: string;
  actorName: string;
  actorAvatar?: string;
  relatedRecord: {
    type: 'LEAD' | 'DEAL' | 'ACCOUNT' | 'CALL' | 'INVOICE';
    id: string;
    name: string;
  };
  metadata?: Record<string, unknown>;
  timestamp: Date;
  createdAt: Date;
}

const ActivitySchema = new Schema<IActivity>(
  {
    activityId: {
      type: String,
      required: true,
      index: true,
    },
    organizationId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'LEAD_CREATED',
        'CALL',
        'EMAIL',
        'WHATSAPP',
        'STAGE_CHANGE',
        'NOTE',
        'TASK',
        'MEETING',
        'PROPOSAL',
        'PAYMENT',
        'AI_INSIGHT',
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    actorId: String,
    actorName: {
      type: String,
      default: 'System',
    },
    actorAvatar: String,
    relatedRecord: {
      type: {
        type: String,
        enum: ['LEAD', 'DEAL', 'ACCOUNT', 'CALL', 'INVOICE'],
        required: true,
      },
      id: { type: String, required: true },
      name: { type: String, required: true },
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

ActivitySchema.index({ organizationId: 1, 'relatedRecord.id': 1, timestamp: -1 });
ActivitySchema.index({ organizationId: 1, timestamp: -1 });

export const ActivityModel = mongoose.model<IActivity>('Activity', ActivitySchema);
