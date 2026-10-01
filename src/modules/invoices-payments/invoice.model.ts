import mongoose, { Schema, Document } from 'mongoose';

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'VOID';

export interface IInvoice extends Document {
  invoiceId: string;
  invoiceNumber: string;
  organizationId: string;
  proposalId?: string;
  dealId?: string;
  company: string;
  recipientEmail: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  dueDate: Date;
  paidAt?: Date;
  paymentProvider?: string;
  paymentId?: string;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<IInvoice>(
  {
    invoiceId: {
      type: String,
      required: true,
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      index: true,
    },
    organizationId: {
      type: String,
      required: true,
      index: true,
    },
    proposalId: String,
    dealId: String,
    company: {
      type: String,
      required: true,
      trim: true,
    },
    recipientEmail: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    status: {
      type: String,
      enum: ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID'],
      default: 'DRAFT',
    },
    dueDate: {
      type: Date,
      required: true,
    },
    paidAt: Date,
    paymentProvider: String,
    paymentId: {
      type: String,
      index: true,
    },
    idempotencyKey: {
      type: String,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

InvoiceSchema.index({ organizationId: 1, createdAt: -1 });
InvoiceSchema.index({ organizationId: 1, status: 1 });

export const InvoiceModel = mongoose.model<IInvoice>('Invoice', InvoiceSchema);
