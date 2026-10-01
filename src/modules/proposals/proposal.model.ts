import mongoose, { Schema, Document } from 'mongoose';

export type ProposalStatus = 'DRAFT' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'DECLINED';

export interface IProposalItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface IProposal extends Document {
  proposalId: string;
  proposalNumber: string;
  organizationId: string;
  dealId?: string;
  dealTitle?: string;
  company: string;
  recipientName: string;
  recipientEmail: string;
  items: IProposalItem[];
  subtotal: number;
  taxRate: number;
  discount: number;
  amount: number;
  currency: string;
  status: ProposalStatus;
  validUntil: Date;
  pdfUrl?: string;
  viewedAt?: Date;
  acceptedAt?: Date;
  declinedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProposalSchema = new Schema<IProposal>(
  {
    proposalId: {
      type: String,
      required: true,
      index: true,
    },
    proposalNumber: {
      type: String,
      required: true,
      index: true,
    },
    organizationId: {
      type: String,
      required: true,
      index: true,
    },
    dealId: {
      type: String,
      index: true,
    },
    dealTitle: String,
    company: {
      type: String,
      required: true,
      trim: true,
    },
    recipientName: {
      type: String,
      required: true,
      trim: true,
    },
    recipientEmail: {
      type: String,
      required: true,
      trim: true,
    },
    items: [
      {
        description: { type: String, required: true },
        quantity: { type: Number, default: 1 },
        unitPrice: { type: Number, required: true },
        total: { type: Number, required: true },
      },
    ],
    subtotal: {
      type: Number,
      default: 0,
    },
    taxRate: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    amount: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    status: {
      type: String,
      enum: ['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'DECLINED'],
      default: 'DRAFT',
    },
    validUntil: {
      type: Date,
      required: true,
    },
    pdfUrl: String,
    viewedAt: Date,
    acceptedAt: Date,
    declinedAt: Date,
  },
  {
    timestamps: true,
  }
);

ProposalSchema.index({ organizationId: 1, createdAt: -1 });
ProposalSchema.index({ organizationId: 1, dealId: 1 });

export const ProposalModel = mongoose.model<IProposal>('Proposal', ProposalSchema);
