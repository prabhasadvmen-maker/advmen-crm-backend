import mongoose from 'mongoose';
import { AttendanceModel, IAttendance, AttendanceStatus } from './attendance.model.js';
import { UserModel } from '../auth/auth.model.js';
import { emitTenantEvent } from '../../config/socket.js';
import { logger } from '../../shared/logger/logger.js';
import { AppError } from '../../shared/errors/AppError.js';

export interface RecordLoginInput {
  userId: string;
  employeeId?: string;
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

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

function parseExternalDateTime(
  isoCandidate?: any,
  dateCandidate?: any,
  timeCandidate?: any
): Date | undefined {
  if (isoCandidate && typeof isoCandidate === 'string' && isoCandidate.trim()) {
    const d = new Date(isoCandidate.trim());
    if (!isNaN(d.getTime())) return d;
  }

  if (timeCandidate && typeof timeCandidate === 'string' && timeCandidate.trim()) {
    const rawTime = timeCandidate.trim();
    if (rawTime.toLowerCase() === 'null' || rawTime.toLowerCase() === 'undefined' || rawTime.toLowerCase() === 'invalid date') {
      return undefined;
    }
    const d = new Date(rawTime);
    if (!isNaN(d.getTime())) return d;

    const rawDate = dateCandidate && typeof dateCandidate === 'string' ? dateCandidate.trim() : '';
    const ddmmyyyy = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const timeMatch = rawTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i);

    if (ddmmyyyy && timeMatch) {
      const day = parseInt(ddmmyyyy[1], 10);
      const month = parseInt(ddmmyyyy[2], 10) - 1;
      const year = parseInt(ddmmyyyy[3], 10);
      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
      const ampm = timeMatch[4]?.toLowerCase();

      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;

      const istOffsetMs = 5.5 * 60 * 60 * 1000;
      const utcMs = Date.UTC(year, month, day, hours, minutes, seconds) - istOffsetMs;
      return new Date(utcMs);
    }

    if (timeMatch) {
      const now = new Date();
      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
      const ampm = timeMatch[4]?.toLowerCase();
      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
      now.setHours(hours, minutes, seconds, 0);
      return now;
    }
  }

  return undefined;
}

export class AttendanceService {
  /**
   * Helper to get current calendar date string in YYYY-MM-DD
   */
  public getTodayDateString(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  /**
   * Records every successful employee sign-in as an event on that day's attendance record.
   */
  async recordLogin(input: RecordLoginInput): Promise<IAttendance> {
    const today = this.getTodayDateString();
    const now = new Date();
    const timeParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const hour = Number(timeParts.find((part) => part.type === 'hour')?.value || 0);
    const minute = Number(timeParts.find((part) => part.type === 'minute')?.value || 0);
    const isLate = hour > 10 || (hour === 10 && minute > 15);
    const status: AttendanceStatus = isLate ? 'LATE' : 'PRESENT';
    const attendanceQuery = {
      organizationId: input.organizationId,
      userId: input.userId,
      date: today,
    };
    const loginEvent = {
      loginTime: now,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    };
    const update = {
      $setOnInsert: {
        ...attendanceQuery,
        loginTime: now,
        status,
      },
      $set: {
        lastActiveAt: now,
        employeeId: input.employeeId,
        userName: input.name,
        userEmail: input.email,
        userPhone: input.phone || '',
        role: input.role,
        department: input.department || 'Sales & Business Development',
        ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
        ...(input.userAgent ? { userAgent: input.userAgent } : {}),
      },
      $push: { loginEvents: loginEvent },
    };
    let record;
    try {
      record = await AttendanceModel.findOneAndUpdate(
        attendanceQuery,
        update,
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      record = await AttendanceModel.findOneAndUpdate(
        attendanceQuery,
        update,
        { new: true }
      );
      if (!record) throw error;
    }

    if (!record) {
      throw AppError.internal('Failed to record attendance');
    }

    logger.info(`✅ Login recorded: ${input.name} (${status}) on ${today} at ${now.toLocaleTimeString()}`);

    // Real-time broadcast over Socket.IO to Admin and Workspace rooms
    try {
      const attendancePayload = {
        id: record._id.toString(),
        userId: record.userId,
        employeeId: record.employeeId,
        userName: record.userName,
        userEmail: record.userEmail,
        userPhone: record.userPhone,
        department: record.department,
        role: record.role,
        date: record.date,
        loginTime: now,
        status: record.status,
        loginCount: record.loginEvents.length,
      };

      // Notify Admin workspace
      emitTenantEvent(input.organizationId, 'attendance:login', attendancePayload);

      // Also send live notification to workspace / admins
      emitTenantEvent(input.organizationId, 'notification:new', {
        id: `att_${Date.now()}`,
        type: 'attendance',
        title: `Employee Login: ${record.userName}`,
        message: `${record.userName} logged in at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} [${status}]`,
        severity: status === 'LATE' ? 'warning' : 'success',
        link: '/attendance',
        timestamp: now.toISOString(),
      });
    } catch (e: any) {
      logger.warn('Socket broadcast for attendance skipped:', e.message);
    }

    return record;
  }

  private lastSyncTime: number = 0;

  /**
   * Synchronize attendance records from external Attendance CRM app (atendence-crm.vercel.app)
   */
  async syncExternalAttendance(organizationId: string): Promise<{ syncedCount: number; message: string }> {
    try {
      const targetOrgId = organizationId || 'org_advmen_platform';
      const endpoints = [
        'https://atendence-crm.vercel.app/api/attendance/all',
        'https://atendence-crm.vercel.app/api/attendance/logs',
      ];

      let rawData: any = null;
      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(8000),
          });
          if (res.ok) {
            const json = (await res.json()) as any;
            if (Array.isArray(json)) {
              rawData = json;
              break;
            } else if (json && Array.isArray(json.data)) {
              rawData = json.data;
              break;
            }
          }
        } catch (e: any) {
          logger.warn(`Failed fetching from ${endpoint}:`, e.message);
        }
      }

      if (!rawData || !Array.isArray(rawData)) {
        rawData = [];
      }

      const users = await UserModel.find().lean();
      let count = 0;

      for (const item of rawData) {
        if (!item) continue;
        const rawEmpId = String(item.empId || item.employeeId || '').trim();
        const empId = rawEmpId.toLowerCase() === 'undefined' || rawEmpId.toLowerCase() === 'null' ? '' : rawEmpId;
        const empName = String(item.empName || item.name || 'Employee').trim();
        const rawEmail = String(item.email || '').trim().toLowerCase();
        const email = rawEmail.toLowerCase() === 'undefined' || rawEmail.toLowerCase() === 'null' || rawEmail === 'n/a' ? '' : rawEmail;

        const loginTime: Date =
          parseExternalDateTime(
            item.punchIn || item.timestamp || item.createdAt,
            item.punchDate,
            item.punchTime || item.loginTime || item.punchInTime
          ) || new Date();

        const logoutTime: Date | undefined =
          parseExternalDateTime(
            item.punchOut,
            item.punchOutDate || item.punchDate,
            item.logoutTime || item.punchOutTime
          );

        const dateStr = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(loginTime);

        // Match existing user from database
        const matchedUser = users.find((u) =>
          (email && u.email && u.email.toLowerCase() === email) ||
          (empId && u.employeeId && u.employeeId.toUpperCase() === empId.toUpperCase()) ||
          (empName && u.name && u.name.toLowerCase() === empName.toLowerCase())
        );

        const userId = matchedUser
          ? matchedUser._id.toString()
          : empId
          ? `ext_${empId.toLowerCase()}`
          : `ext_${empName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        const userName = matchedUser ? matchedUser.name : empName;
        const userEmail = matchedUser
          ? matchedUser.email
          : email || `${(empId || empName).toLowerCase().replace(/[^a-z0-9]/g, '')}@attendance.external`;
        const userPhone = matchedUser?.phone || '';
        const role = matchedUser?.role || 'SALES_REP';
        const department = matchedUser?.department || 'Sales & Business Development';
        const employeeId = matchedUser?.employeeId || empId || 'EMP-2026-0004';

        const statusRaw = String(item.status || 'Present').toUpperCase();
        const status: AttendanceStatus =
          statusRaw === 'LATE'
            ? 'LATE'
            : statusRaw === 'ON_LEAVE'
            ? 'ON_LEAVE'
            : statusRaw === 'HALF_DAY'
            ? 'HALF_DAY'
            : 'PRESENT';

        let selfieUrl = String(item.selfie || item.imageUrl || '').trim();
        if (selfieUrl) {
          if (selfieUrl.startsWith('data:image')) {
            // Keep direct base64 image data
          } else if (selfieUrl.startsWith('/')) {
            selfieUrl = `https://atendence-crm.vercel.app${selfieUrl}`;
          } else if (selfieUrl.startsWith('http://atendence-crm.vercel.app')) {
            selfieUrl = selfieUrl.replace('http://atendence-crm.vercel.app', 'https://atendence-crm.vercel.app');
          }
        }
        if (!selfieUrl && item.recordId) {
          selfieUrl = `https://atendence-crm.vercel.app/api/attendance/image/${item.recordId}`;
        }

        const location = {
          address: item.location?.address || 'N/A',
          lat: typeof item.location?.lat === 'number' ? item.location.lat : undefined,
          lng: typeof item.location?.lng === 'number' ? item.location.lng : undefined,
          accuracy: typeof item.location?.accuracy === 'number' ? item.location.accuracy : undefined,
          googleMapsUrl:
            item.location?.googleMapsUrl ||
            (item.location?.lat && item.location?.lng
              ? `https://www.google.com/maps?q=${item.location.lat},${item.location.lng}`
              : undefined),
        };

        const recordIdStr = String(item.recordId || item._id || '').trim();
        const recordIdObj =
          recordIdStr && mongoose.isValidObjectId(recordIdStr) ? new mongoose.Types.ObjectId(recordIdStr) : null;

        // Search for any existing attendance document that represents this record
        const matchCriteria: any[] = [];
        if (recordIdStr) matchCriteria.push({ externalRecordId: recordIdStr });
        if (recordIdObj) matchCriteria.push({ _id: recordIdObj });
        matchCriteria.push({ organizationId: targetOrgId, userId, date: dateStr });
        if (empId) matchCriteria.push({ organizationId: targetOrgId, employeeId: empId, date: dateStr });

        const existingDoc = await AttendanceModel.findOne({ $or: matchCriteria });

        const finalLogout = logoutTime || (existingDoc && existingDoc.logoutTime ? existingDoc.logoutTime : null);

        if (existingDoc) {
          existingDoc.organizationId = targetOrgId;
          existingDoc.userId = userId;
          existingDoc.employeeId = employeeId;
          existingDoc.userName = userName;
          existingDoc.userEmail = userEmail;
          existingDoc.userPhone = userPhone || existingDoc.userPhone;
          existingDoc.role = role;
          existingDoc.department = department;
          existingDoc.date = dateStr;
          existingDoc.loginTime = loginTime || existingDoc.loginTime;
          existingDoc.lastActiveAt = finalLogout || existingDoc.lastActiveAt || loginTime;
          existingDoc.logoutTime = finalLogout || undefined;
          existingDoc.status = status;
          if (selfieUrl) existingDoc.selfieUrl = selfieUrl;
          if (location.address && location.address !== 'N/A') existingDoc.location = location;
          existingDoc.source = 'EXTERNAL_ATTENDANCE_APP';
          if (recordIdStr) existingDoc.externalRecordId = recordIdStr;

          existingDoc.loginEvents = [
            {
              loginTime: existingDoc.loginTime || loginTime,
              logoutTime: finalLogout || undefined,
              ipAddress: 'Selfie + GPS',
              userAgent: location.address !== 'N/A' ? location.address : 'Attendance CRM Web App',
            },
          ];

          await existingDoc.save();
          count++;
        } else {
          await AttendanceModel.create({
            organizationId: targetOrgId,
            userId,
            employeeId,
            userName,
            userEmail,
            userPhone,
            role,
            department,
            date: dateStr,
            loginTime,
            lastActiveAt: finalLogout || loginTime,
            logoutTime: finalLogout || undefined,
            status,
            selfieUrl: selfieUrl || (recordIdStr ? `https://atendence-crm.vercel.app/api/attendance/image/${recordIdStr}` : ''),
            location,
            source: 'EXTERNAL_ATTENDANCE_APP',
            externalRecordId: recordIdStr || undefined,
            loginEvents: [
              {
                loginTime,
                logoutTime: finalLogout || undefined,
                ipAddress: 'Selfie + GPS',
                userAgent: location.address !== 'N/A' ? location.address : 'Attendance CRM Web App',
              },
            ],
          });
          count++;
        }
      }

      // Also auto-normalize any raw attendance records in MongoDB that might be unassigned
      const unassignedDocs = await AttendanceModel.collection.find({
        $or: [
          { organizationId: { $exists: false } },
          { organizationId: null },
          { date: { $exists: false } },
          { date: null },
        ],
      }).toArray();

      for (const unassigned of unassignedDocs) {
        const uName = String(unassigned.empName || unassigned.name || 'abhi').trim();
        const uEmail = String(unassigned.email || '').trim().toLowerCase();
        const matched = users.find((u) =>
          (uEmail && u.email && u.email.toLowerCase() === uEmail) ||
          (uName && u.name && u.name.toLowerCase() === uName.toLowerCase())
        );

        const uTime = unassigned.createdAt ? new Date(unassigned.createdAt) : new Date();
        const uDateStr = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(uTime);

        const uLogoutRaw = unassigned.punchOut || unassigned.logoutTime;
        let uLogoutTime: Date | undefined = undefined;
        if (uLogoutRaw) {
          const pot = new Date(uLogoutRaw);
          if (!isNaN(pot.getTime())) uLogoutTime = pot;
        }

        const uStatusRaw = String(unassigned.status || 'Present').toUpperCase();
        const uStatus = uStatusRaw === 'LATE' ? 'LATE' : uStatusRaw === 'ON_LEAVE' ? 'ON_LEAVE' : uStatusRaw === 'HALF_DAY' ? 'HALF_DAY' : 'PRESENT';

        let uSelfie = typeof unassigned.selfie === 'string' && unassigned.selfie.startsWith('data:image')
          ? unassigned.selfie
          : `https://atendence-crm.vercel.app/api/attendance/image/${unassigned._id.toString()}`;

        await AttendanceModel.collection.updateOne(
          { _id: unassigned._id },
          {
            $set: {
              organizationId: targetOrgId,
              userId: matched ? matched._id.toString() : `ext_${uName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
              employeeId: matched?.employeeId || 'EMP-2026-0004',
              userName: matched?.name || uName,
              userEmail: matched?.email || (uEmail || 'abh@gmail.com'),
              role: matched?.role || 'SALES_REP',
              department: matched?.department || 'Sales & Business Development',
              date: uDateStr,
              loginTime: uTime,
              lastActiveAt: uLogoutTime || uTime,
              logoutTime: uLogoutTime || null,
              status: uStatus,
              selfieUrl: uSelfie,
              source: 'EXTERNAL_ATTENDANCE_APP',
              externalRecordId: unassigned._id.toString(),
              loginEvents: [
                {
                  loginTime: uTime,
                  logoutTime: uLogoutTime || null,
                  ipAddress: 'Selfie + GPS',
                  userAgent: 'Attendance CRM Web App',
                },
              ],
            },
          }
        );
        count++;
      }

      this.lastSyncTime = Date.now();
      logger.info(`✅ Synchronized ${count} attendance records from external Attendance app.`);
      return { syncedCount: count, message: `Successfully synced ${count} records from attendance app.` };
    } catch (error: any) {
      logger.error('Error syncing external attendance:', error);
      return { syncedCount: 0, message: error.message };
    }
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
    // Automatically sync external attendance if initial or if 10 seconds have elapsed
    if (Date.now() - this.lastSyncTime > 10000) {
      await this.syncExternalAttendance(organizationId).catch((err) => {
        logger.warn('External attendance auto-sync note:', err.message);
      });
    }

    const selectedDate = filters.date && filters.date !== 'ALL' ? filters.date : this.getTodayDateString();
    const query: Record<string, any> = {};

    if (!isSuperAdmin) {
      query.organizationId = organizationId;
    } else if (filters.search && filters.search.startsWith('org_')) {
      query.organizationId = filters.search;
    }

    if (filters.date) {
      if (filters.date !== 'ALL') {
        query.date = filters.date;
      }
    } else if (filters.startDate && filters.endDate) {
      query.date = { $gte: filters.startDate, $lte: filters.endDate };
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
      role: { $nin: ['SUPER_ADMIN', 'ORG_ADMIN'] },
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
   * Record employee punch-out / logout with actor attribution (ADMIN or EMPLOYEE)
   */
  async recordLogout(
    organizationId: string,
    userId: string,
    logoutBy: 'ADMIN' | 'EMPLOYEE' | 'SYSTEM' = 'EMPLOYEE',
    adminName?: string
  ): Promise<IAttendance | null> {
    const today = this.getTodayDateString();
    let record = await AttendanceModel.findOne({
      organizationId,
      userId,
      date: today,
    }).sort({ loginTime: -1 });

    if (!record) {
      record = await AttendanceModel.findOne({
        organizationId,
        userId,
        logoutTime: { $exists: false },
      }).sort({ loginTime: -1 });
    }
    if (!record) return null;

    const now = new Date();
    const activeEvent = [...record.loginEvents].reverse().find((event) => !event.logoutTime);
    if (activeEvent) {
      activeEvent.logoutTime = now;
      activeEvent.logoutBy = logoutBy;
      activeEvent.logoutAdminName = adminName;
    }
    record.logoutTime = now;
    record.logoutBy = logoutBy;
    record.logoutAdminName = adminName;
    await record.save();

    try {
      emitTenantEvent(organizationId, 'attendance:logout', {
        id: record._id.toString(),
        userId: record.userId,
        userName: record.userName,
        logoutTime: now,
        logoutBy,
        logoutAdminName: adminName,
      });

      emitTenantEvent(organizationId, 'notification:new', {
        id: `att_logout_${Date.now()}`,
        type: 'attendance',
        title: `Employee Punch Out: ${record.userName}`,
        message: `${record.userName} logged out by ${logoutBy === 'ADMIN' ? `Admin (${adminName || 'Super Admin'})` : 'Employee'} at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        severity: 'info',
        link: '/attendance',
        timestamp: now.toISOString(),
      });
    } catch (e: any) {
      logger.warn('Socket broadcast for attendance logout note:', e.message);
    }

    return record;
  }
}

export const attendanceService = new AttendanceService();
