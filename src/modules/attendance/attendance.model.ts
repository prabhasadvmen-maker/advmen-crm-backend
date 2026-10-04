import mongoose, { Schema, Document } from 'mongoose';

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ON_LEAVE';

export interface IAttendanceLoginEvent {
  loginTime: Date;
  logoutTime?: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface IAttendance extends Document {
  organizationId: string;
  userId: string;
  employeeId?: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  role: string;
  department: string;
  date: string; // Format: "YYYY-MM-DD"
  loginTime: Date; // Punch-in time
  lastActiveAt: Date;
  logoutTime?: Date;
  loginEvents: IAttendanceLoginEvent[];
  status: AttendanceStatus;
  selfieUrl?: string;
  location?: {
    address?: string;
    lat?: number;
    lng?: number;
    accuracy?: number;
    googleMapsUrl?: string;
  };
  source?: 'SYSTEM_LOGIN' | 'EXTERNAL_ATTENDANCE_APP';
  externalRecordId?: string;
  ipAddress?: string;
  userAgent?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceLoginEventSchema = new Schema<IAttendanceLoginEvent>(
  {
    loginTime: { type: Date, required: true },
    logoutTime: { type: Date },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { _id: false }
);

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
    employeeId: {
      type: String,
      trim: true,
      uppercase: true,
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
    loginEvents: {
      type: [AttendanceLoginEventSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['PRESENT', 'LATE', 'HALF_DAY', 'ON_LEAVE'],
      default: 'PRESENT',
    },
    selfieUrl: {
      type: String,
      trim: true,
    },
    location: {
      address: { type: String, trim: true },
      lat: { type: Number },
      lng: { type: Number },
      accuracy: { type: Number },
      googleMapsUrl: { type: String, trim: true },
    },
    source: {
      type: String,
      enum: ['SYSTEM_LOGIN', 'EXTERNAL_ATTENDANCE_APP'],
      default: 'SYSTEM_LOGIN',
    },
    externalRecordId: {
      type: String,
      trim: true,
      index: true,
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

// Index for fast tenant employee date queries
AttendanceSchema.index({ organizationId: 1, userId: 1, date: 1 });
AttendanceSchema.index({ organizationId: 1, date: 1, status: 1 });
AttendanceSchema.index({ organizationId: 1, loginTime: -1 });

export const AttendanceModel = mongoose.model<IAttendance>('Attendance', AttendanceSchema);
