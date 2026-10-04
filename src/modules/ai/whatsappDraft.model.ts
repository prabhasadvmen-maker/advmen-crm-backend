import { Document, Schema, model } from 'mongoose';

export type WhatsAppDraftStatus =
  | 'PENDING_APPROVAL'
  | 'SENDING'
  | 'SENT'
  | 'REJECTED'
  | 'FAILED'
  | 'SEND_UNKNOWN';

export interface IWhatsAppDraft extends Document {
  organizationId: string;
  leadId: string;
  sourceKey: string;
  leadName: string;
  recipientPhone: string;
  queryText?: string;
  outstandingAmount: number;
  currency: string;
  message: string;
  status: WhatsAppDraftStatus;
  generatedBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  sentAt?: Date;
  providerMessageId?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WhatsAppDraftSchema = new Schema<IWhatsAppDraft>(
  {
    organizationId: { type: String, required: true, index: true },
    leadId: { type: String, required: true },
    sourceKey: { type: String, required: true },
    leadName: { type: String, required: true },
    recipientPhone: { type: String, required: true },
    queryText: String,
    outstandingAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'INR' },
    message: { type: String, required: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ['PENDING_APPROVAL', 'SENDING', 'SENT', 'REJECTED', 'FAILED', 'SEND_UNKNOWN'],
      required: true,
      default: 'PENDING_APPROVAL',
      index: true,
    },
    generatedBy: { type: String, required: true },
    approvedBy: String,
    approvedAt: Date,
    sentAt: Date,
    providerMessageId: String,
    errorMessage: String,
  },
  { timestamps: true }
);

WhatsAppDraftSchema.index({ organizationId: 1, sourceKey: 1 }, { unique: true });
WhatsAppDraftSchema.index({ organizationId: 1, status: 1, createdAt: -1 });

export const WhatsAppDraftModel = model<IWhatsAppDraft>('WhatsAppDraft', WhatsAppDraftSchema);
