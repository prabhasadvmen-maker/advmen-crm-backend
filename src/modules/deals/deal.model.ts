import mongoose, { Schema, Document } from 'mongoose';

export type DealStage =
  | 'DISCOVERY'
  | 'QUALIFICATION'
  | 'PROPOSAL'
  | 'NEGOTIATION'
  | 'WON'
  | 'LOST';

export type DealHealth = 'HEALTHY' | 'AT_RISK' | 'CRITICAL';

export interface IDealStageTransition {
  fromStage?: string;
  toStage: string;
  actorId: string;
  reason?: string;
  transitionedAt: Date;
}

export interface IDeal extends Document {
  dealId: string;
  organizationId: string;
  title: string;
  leadId?: string;
  company: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  value: number;
  currency: string;
  stage: DealStage;
  pipelineId: string;
  probability: number;
  expectedCloseDate: Date;
  ownerId?: string;
  assignedTo?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  health: DealHealth;
  notes?: string;
  contactAddress?: string;
  lossReason?: string;
  competitorLostTo?: string;
  transitions: IDealStageTransition[];
  customFields?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const DealSchema = new Schema<IDeal>(
  {
    dealId: {
      type: String,
      required: true,
      index: true,
    },
    organizationId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    leadId: {
      type: String,
      index: true,
    },
    company: {
      type: String,
      required: true,
      trim: true,
    },
    contactName: {
      type: String,
      required: true,
      trim: true,
    },
    contactEmail: {
      type: String,
      trim: true,
    },
    contactPhone: {
      type: String,
      trim: true,
    },
    value: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    stage: {
      type: String,
      enum: ['DISCOVERY', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'],
      default: 'DISCOVERY',
    },
    pipelineId: {
      type: String,
      default: 'pipe_default',
      index: true,
    },
    probability: {
      type: Number,
      default: 10,
      min: 0,
      max: 100,
    },
    expectedCloseDate: {
      type: Date,
      required: true,
    },
    ownerId: {
      type: String,
      index: true,
    },
    assignedTo: {
      id: String,
      name: String,
      avatarUrl: String,
    },
    health: {
      type: String,
      enum: ['HEALTHY', 'AT_RISK', 'CRITICAL'],
      default: 'HEALTHY',
    },
    notes: {
      type: String,
      trim: true,
    },
    contactAddress: {
      type: String,
      trim: true,
    },
    lossReason: {
      type: String,
    },
    competitorLostTo: {
      type: String,
    },
    transitions: [
      {
        fromStage: String,
        toStage: { type: String, required: true },
        actorId: { type: String, required: true },
        reason: String,
        transitionedAt: { type: Date, default: Date.now },
      },
    ],
    customFields: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Critical compound indexes specified in PDF Section 16
DealSchema.index({ organizationId: 1, createdAt: -1 });
DealSchema.index({ organizationId: 1, pipelineId: 1, stage: 1 });
DealSchema.index({ organizationId: 1, ownerId: 1, stage: 1 });
DealSchema.index({ organizationId: 1, expectedCloseDate: 1 });

export const DealModel = mongoose.model<IDeal>('Deal', DealSchema);
