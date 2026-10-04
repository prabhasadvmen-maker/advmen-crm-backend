import { Request, Response } from 'express';
import { attendanceService } from './attendance.service.js';
import { AppError } from '../../shared/errors/AppError.js';
import { AuthenticatedUser } from '../../middleware/auth.middleware.js';

export class AttendanceController {
  /**
   * GET /api/v1/attendance
   * Administrator view of attendance roster and analytics
   */
  async getAttendanceList(req: Request, res: Response): Promise<void> {
    const user = (req as any).user as AuthenticatedUser;
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN') {
      throw AppError.forbidden('Only administrators can view employee attendance');
    }
    const { date, startDate, endDate, userId, department, status, search, page, limit } = req.query;

    const isSuperAdmin = user.role === 'SUPER_ADMIN';

    const result = await attendanceService.getAttendanceList(
      user.organizationId,
      {
        date: date as string,
        startDate: startDate as string,
        endDate: endDate as string,
        userId: userId as string,
        department: department as string,
        status: status as any,
        search: search as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 100,
      },
      isSuperAdmin
    );

    res.status(200).json(result);
  }

  /**
   * GET /api/v1/attendance/my
   * Logged-in employee viewing their own attendance log
   */
  async getMyAttendance(req: Request, res: Response): Promise<void> {
    const user = (req as any).user as AuthenticatedUser;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;

    const history = await attendanceService.getEmployeeHistory(user.organizationId, user.id, limit);
    res.status(200).json({ history });
  }

  /**
   * POST /api/v1/attendance/punch-out
   * Logged-in employee recording punch out
   */
  async punchOut(req: Request, res: Response): Promise<void> {
    const user = (req as any).user as AuthenticatedUser;
    const updated = await attendanceService.recordLogout(user.organizationId, user.id);

    res.status(200).json({
      success: true,
      message: 'Punch-out recorded successfully',
      record: updated,
    });
  }

  /**
   * POST /api/v1/attendance/sync
   * Admin triggers manual sync with external Attendance CRM app
   */
  async syncExternalAttendance(req: Request, res: Response): Promise<void> {
    const user = (req as any).user as AuthenticatedUser;
    const result = await attendanceService.syncExternalAttendance(user.organizationId);

    res.status(200).json({
      success: true,
      message: result.message,
      syncedCount: result.syncedCount,
    });
  }
}

export const attendanceController = new AttendanceController();
