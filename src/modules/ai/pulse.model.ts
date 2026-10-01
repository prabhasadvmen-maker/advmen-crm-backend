import mongoose, { Schema, Document } from 'mongoose';
import { PulseConfidence, PulseIssueType } from './pulse.types.js';

export type PulseDecisionStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'DISPATCHED' | 'DISMISSED';

export interface IPulseDecision extends Document {
  organizationId: string;
  issueId: string;
  issueType: PulseIssueType;
  entityId: string;
  customerName: string;
  companyName: string;
  contactEmail?: string;
  contactPhone?: string;
  financialMetrics: {
    amount: number;
    currency: string;
    formatted_amount: string;
    days_overdue?: number;
    probability_pct?: number;
  };
  reason: string;
  recommendedAction: string;
  messageDraft: string;
  confidence: PulseConfidence;
  assumptions: string[];
  requiresApproval: boolean;
  status: PulseDecisionStatus;
  executedAt?: Date;
  executedBy?: string;
  executionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PulseDecisionSchema = new Schema<IPulseDecision>(
  {
    organizationId: {
      type: String,
      required: true,
      index: true,
    },
    issueId: {
      type: String,
      required: true,
      index: true,
    },
    issueType: {
      type: String,
      required: true,
    },
    entityId: {
      type: String,
      required: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    companyName: {
      type: String,
      required: true,
    },
    contactEmail: String,
    contactPhone: String,
    financialMetrics: {
      amount: Number,
      currency: String,
      formatted_amount: String,
      days_overdue: Number,
      probability_pct: Number,
    },
    reason: {
      type: String,
      required: true,
    },
    recommendedAction: {
      type: String,
      required: true,
    },
    messageDraft: {
      type: String,
      required: true,
    },
    confidence: {
      type: String,
      enum: ['HIGH', 'MEDIUM', 'LOW'],
      default: 'HIGH',
    },
    assumptions: [String],
    requiresApproval: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['PENDING_APPROVAL', 'APPROVED', 'DISPATCHED', 'DISMISSED'],
      default: 'PENDING_APPROVAL',
      index: true,
    },
    executedAt: Date,
    executedBy: String,
    executionNotes: String,
  },
  {
    timestamps: true,
  }
);

export const PulseDecisionModel = mongoose.model<IPulseDecision>(
  'PulseDecision',
  PulseDecisionSchema
);
