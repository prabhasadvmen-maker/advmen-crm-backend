import mongoose, { Schema, Document } from 'mongoose';

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ON_LEAVE';

export interface IAttendance extends Document {
  organizationId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  role: string;
  department: string;
  date: string; // Format: "YYYY-MM-DD"
  loginTime: Date; // Punch-in time
  lastActiveAt: Date;
  logoutTime?: Date;
  status: AttendanceStatus;
  ipAddress?: string;
  userAgent?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
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
    userName: {
      type: String,
      required: true,
      trim: true,
    },
    userEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    userPhone: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      default: 'SALES_REP',
    },
    department: {
      type: String,
      default: 'Sales & Business Development',
      trim: true,
    },
    date: {
      type: String, // "YYYY-MM-DD"
      required: true,
      index: true,
    },
    loginTime: {
      type: Date,
      default: Date.now,
      required: true,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    logoutTime: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['PRESENT', 'LATE', 'HALF_DAY', 'ON_LEAVE'],
      default: 'PRESENT',
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// One attendance record per employee per calendar date per tenant
AttendanceSchema.index({ organizationId: 1, userId: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ organizationId: 1, date: 1, status: 1 });
AttendanceSchema.index({ organizationId: 1, loginTime: -1 });

export const AttendanceModel = mongoose.model<IAttendance>('Attendance', AttendanceSchema);
