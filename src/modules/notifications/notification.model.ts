import mongoose, { Schema, Document } from 'mongoose';

export type NotificationType = 'lead' | 'deal' | 'task' | 'call' | 'attendance' | 'announcement' | 'system';
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'urgent';

export interface INotification extends Document {
  organizationId: string;
  recipientUserId: string; // User ID or 'ALL_EMPLOYEES'
  title: string;
  message: string;
  type: NotificationType;
  severity: NotificationSeverity;
  link?: string;
  read: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    organizationId: {
      type: String,
      required: true,
      index: true,
    },
    recipientUserId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['lead', 'deal', 'task', 'call', 'attendance', 'announcement', 'system'],
      default: 'system',
    },
    severity: {
      type: String,
      enum: ['info', 'success', 'warning', 'urgent'],
      default: 'info',
    },
    link: {
      type: String,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

NotificationSchema.index({ organizationId: 1, recipientUserId: 1, createdAt: -1 });

export const NotificationModel = mongoose.model<INotification>('Notification', NotificationSchema);
