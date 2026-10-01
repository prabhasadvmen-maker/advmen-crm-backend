import mongoose, { Schema, Document } from 'mongoose';

export interface IOrganization extends Document {
  organizationId: string;
  name: string;
  slug: string;
  planTier: 'STARTER' | 'BUSINESS' | 'ENTERPRISE';
  planStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
  limits: {
    maxUsers: number;
    maxLeads: number;
    maxStorageMb: number;
    aiTokensIncluded: number;
  };
  settings: {
    timezone: string;
    currency: string;
    leadResponseSlaMinutes: number;
    allowTelephonyRecording: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    organizationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    planTier: {
      type: String,
      enum: ['STARTER', 'BUSINESS', 'ENTERPRISE'],
      default: 'STARTER',
    },
    planStatus: {
      type: String,
      enum: ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED'],
      default: 'TRIAL',
    },
    limits: {
      maxUsers: { type: Number, default: 5 },
      maxLeads: { type: Number, default: 1000 },
      maxStorageMb: { type: Number, default: 5120 },
      aiTokensIncluded: { type: Number, default: 50000 },
    },
    settings: {
      timezone: { type: String, default: 'UTC' },
      currency: { type: String, default: 'USD' },
      leadResponseSlaMinutes: { type: Number, default: 15 },
      allowTelephonyRecording: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
  }
);

export const OrganizationModel = mongoose.model<IOrganization>('Organization', OrganizationSchema);
