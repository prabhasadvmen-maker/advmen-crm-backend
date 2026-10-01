import { AttendanceModel, IAttendance, AttendanceStatus } from './attendance.model.js';
import { UserModel } from '../auth/auth.model.js';
import { emitTenantEvent, emitUserEvent } from '../../config/socket.js';
import { logger } from '../../shared/logger/logger.js';

export interface RecordLoginInput {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  department?: string;
  organizationId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AttendanceFilterQuery {
  date?: string; // "YYYY-MM-DD"
  startDate?: string;
  endDate?: string;
  userId?: string;
  department?: string;
  status?: AttendanceStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export class AttendanceService {
  /**
   * Helper to get current calendar date string in YYYY-MM-DD
   */
  public getTodayDateString(): string {
    const now = new Date();
    // Use local or ISO format YYYY-MM-DD
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Records morning login or updates active timestamp when employee signs in
   */
  async recordLogin(input: RecordLoginInput): Promise<IAttendance> {
    const today = this.getTodayDateString();
    const now = new Date();

    // Check if an attendance record already exists for today
    let record = await AttendanceModel.findOne({
      organizationId: input.organizationId,
      userId: input.userId,
      date: today,
    });

    if (record) {
      // Already punched in today; refresh lastActiveAt and IP if changed
      record.lastActiveAt = now;
      if (input.ipAddress) record.ipAddress = input.ipAddress;
      if (input.userAgent) record.userAgent = input.userAgent;
      await record.save();
      logger.info(`🕒 Employee '${input.name}' re-authenticated today (${today}) at ${now.toLocaleTimeString()}`);
      return record;
    }

    // Determine status: Late threshold is after 10:15 AM
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const isLate = hours > 10 || (hours === 10 && minutes > 15);
    const status: AttendanceStatus = isLate ? 'LATE' : 'PRESENT';

    record = await AttendanceModel.create({
      organizationId: input.organizationId,
      userId: input.userId,
      userName: input.name,
      userEmail: input.email,
      userPhone: input.phone || '',
      role: input.role,
      department: input.department || 'Sales & Business Development',
      date: today,
      loginTime: now,
      lastActiveAt: now,
      status,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    logger.info(`✅ Morning Punch-In Recorded: ${input.name} (${status}) on ${today} at ${now.toLocaleTimeString()}`);

    // Real-time broadcast over Socket.IO to Admin and Workspace rooms
    try {
      const attendancePayload = {
        id: record._id.toString(),
        userId: record.userId,
        userName: record.userName,
        userEmail: record.userEmail,
        userPhone: record.userPhone,
        department: record.department,
        role: record.role,
        date: record.date,
        loginTime: record.loginTime,
        status: record.status,
      };

      // Notify Admin workspace
      emitTenantEvent(input.organizationId, 'attendance:login', attendancePayload);

      // Also send live notification to workspace / admins
      emitTenantEvent(input.organizationId, 'notification:new', {
        id: `att_${Date.now()}`,
        type: 'attendance',
        title: `Employee Morning Login: ${record.userName}`,
        message: `${record.userName} logged in at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} [${status}]`,
        severity: status === 'LATE' ? 'warning' : 'success',
        link: '/admin?tab=attendance',
        timestamp: now.toISOString(),
      });
    } catch (e: any) {
      logger.warn('Socket broadcast for attendance skipped:', e.message);
    }

    return record;
  }

  /**
   * Retrieves attendance records with advanced filtering and today summary analytics
   */
  async getAttendanceList(
    organizationId: string,
    filters: AttendanceFilterQuery,
    isSuperAdmin: boolean = false
  ): Promise<{
    records: IAttendance[];
    total: number;
    summary: {
      totalEmployees: number;
      presentToday: number;
      lateToday: number;
      absentToday: number;
      attendanceRate: number;
      selectedDate: string;
    };
  }> {
    const selectedDate = filters.date || this.getTodayDateString();
    const query: Record<string, any> = {};

    if (!isSuperAdmin) {
      query.organizationId = organizationId;
    } else if (filters.search && filters.search.startsWith('org_')) {
      query.organizationId = filters.search;
    }

    if (filters.date) {
      query.date = filters.date;
    } else if (filters.startDate && filters.endDate) {
      query.date = { $gte: filters.startDate, $lte: filters.endDate };
    } else {
      query.date = selectedDate;
    }

    if (filters.userId) query.userId = filters.userId;
    if (filters.status) query.status = filters.status;
    if (filters.department && filters.department !== 'ALL') query.department = filters.department;

    if (filters.search) {
      const regex = new RegExp(filters.search.trim(), 'i');
      query.$or = [{ userName: regex }, { userEmail: regex }, { userPhone: regex }, { department: regex }];
    }

    const page = filters.page || 1;
    const limit = filters.limit || 100;
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      AttendanceModel.find(query).sort({ loginTime: -1 }).skip(skip).limit(limit).lean(),
      AttendanceModel.countDocuments(query),
    ]);

    // Compute Summary for the selected date
    const orgFilter = !isSuperAdmin ? { organizationId } : {};
    const totalStaff = await UserModel.countDocuments({
      ...orgFilter,
      isActive: true,
      role: { $ne: 'SUPER_ADMIN' },
    });

    const todayStats = await AttendanceModel.aggregate([
      { $match: { ...orgFilter, date: selectedDate } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    let presentToday = 0;
    let lateToday = 0;

    todayStats.forEach((st) => {
      if (st._id === 'PRESENT') presentToday += st.count;
      else if (st._id === 'LATE') lateToday += st.count;
    });

    const totalMarked = presentToday + lateToday;
    const absentToday = Math.max(0, totalStaff - totalMarked);
    const attendanceRate = totalStaff > 0 ? Math.round((totalMarked / totalStaff) * 100) : 0;

    return {
      records: records as unknown as IAttendance[],
      total,
      summary: {
        totalEmployees: totalStaff,
        presentToday,
        lateToday,
        absentToday,
        attendanceRate,
        selectedDate,
      },
    };
  }

  /**
   * Retrieves individual employee attendance history
   */
  async getEmployeeHistory(organizationId: string, userId: string, limit: number = 30): Promise<IAttendance[]> {
    return AttendanceModel.find({ organizationId, userId })
      .sort({ date: -1 })
      .limit(limit)
      .lean() as unknown as Promise<IAttendance[]>;
  }

  /**
   * Record employee punch-out
   */
  async recordLogout(organizationId: string, userId: string): Promise<IAttendance | null> {
    const today = this.getTodayDateString();
    return AttendanceModel.findOneAndUpdate(
      { organizationId, userId, date: today },
      { $set: { logoutTime: new Date() } },
      { new: true }
    );
  }
}

export const attendanceService = new AttendanceService();
