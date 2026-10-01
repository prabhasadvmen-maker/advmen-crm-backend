import mongoose, { Schema, Document } from 'mongoose';

export type CallStatus = 'QUEUED' | 'RINGING' | 'CONNECTED' | 'COMPLETED' | 'MISSED' | 'BUSY' | 'FAILED';
export type CallDisposition =
  | 'INTERESTED'
  | 'CALLBACK_REQUESTED'
  | 'NOT_INTERESTED'
  | 'WRONG_NUMBER'
  | 'MEETING_BOOKED'
  | 'VOICEMAIL';

export interface ICall extends Document {
  callId: string;
  providerCallId?: string;
  organizationId: string;
  leadId: string;
  leadName?: string;
  leadPhone: string;
  leadCompany?: string;
  userId: string;
  callerName: string;
  status: CallStatus;
  disposition?: CallDisposition;
  durationSeconds: number;
  startedAt?: Date;
  endedAt?: Date;
  recordingKey?: string;
  recordingUrl?: string;
  transcriptSnippet?: string;
  aiSentiment?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  notes?: string;
  consentStatus: 'CONSENTED' | 'NOT_RECORDED' | 'OPTED_OUT';
  createdAt: Date;
  updatedAt: Date;
}

const CallSchema = new Schema<ICall>(
  {
    callId: {
      type: String,
      required: true,
      index: true,
    },
    providerCallId: {
      type: String,
      index: true,
    },
    organizationId: {
      type: String,
      required: true,
      index: true,
    },
    leadId: {
      type: String,
      required: true,
      index: true,
    },
    leadName: String,
    leadPhone: {
      type: String,
      required: true,
    },
    leadCompany: String,
    userId: {
      type: String,
      required: true,
      index: true,
    },
    callerName: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['QUEUED', 'RINGING', 'CONNECTED', 'COMPLETED', 'MISSED', 'BUSY', 'FAILED'],
      default: 'QUEUED',
    },
    disposition: {
      type: String,
      enum: [
        'INTERESTED',
        'CALLBACK_REQUESTED',
        'NOT_INTERESTED',
        'WRONG_NUMBER',
        'MEETING_BOOKED',
        'VOICEMAIL',
      ],
    },
    durationSeconds: {
      type: Number,
      default: 0,
    },
    startedAt: Date,
    endedAt: Date,
    recordingKey: String,
    recordingUrl: String,
    transcriptSnippet: String,
    aiSentiment: {
      type: String,
      enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'],
    },
    notes: String,
    consentStatus: {
      type: String,
      enum: ['CONSENTED', 'NOT_RECORDED', 'OPTED_OUT'],
      default: 'NOT_RECORDED',
    },
  },
  {
    timestamps: true,
  }
);

CallSchema.index({ organizationId: 1, createdAt: -1 });
CallSchema.index({ organizationId: 1, userId: 1, createdAt: -1 });
CallSchema.index({ organizationId: 1, leadId: 1 });

export const CallModel = mongoose.model<ICall>('Call', CallSchema);
