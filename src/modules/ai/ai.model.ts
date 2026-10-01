import mongoose, { Schema, Document } from 'mongoose';

export interface IAiUsage extends Document {
  organizationId: string;
  userId: string;
  feature: string; // 'lead_summary' | 'next_best_action' | 'call_summary' | 'email_draft' | 'forecast'
  provider: string; // 'google' | 'openai' | 'anthropic' | 'mock'
  aiModel: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  status: 'SUCCESS' | 'ERROR' | 'THROTTLED';
  errorMessage?: string;
  createdAt: Date;
}

const AiUsageSchema = new Schema<IAiUsage>(
  {
    organizationId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    feature: {
      type: String,
      required: true,
      index: true,
    },
    provider: {
      type: String,
      default: 'gemini',
    },
    aiModel: {
      type: String,
      default: 'gemini-1.5-flash',
    },

    promptTokens: {
      type: Number,
      default: 0,
    },
    completionTokens: {
      type: Number,
      default: 0,
    },
    totalTokens: {
      type: Number,
      default: 0,
    },
    estimatedCostUsd: {
      type: Number,
      default: 0,
    },
    latencyMs: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'ERROR', 'THROTTLED'],
      default: 'SUCCESS',
    },
    errorMessage: String,
  },
  {
    timestamps: true,
  }
);

AiUsageSchema.index({ organizationId: 1, createdAt: -1 });
AiUsageSchema.index({ organizationId: 1, feature: 1 });

export const AiUsageModel = mongoose.model<IAiUsage>('AiUsage', AiUsageSchema);
