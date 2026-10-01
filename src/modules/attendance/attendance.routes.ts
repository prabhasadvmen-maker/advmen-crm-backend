import { Router } from 'express';
import { attendanceController } from './attendance.controller.js';
// 1. Sahi name import karein
import { authMiddleware } from '../../middleware/auth.middleware.js'; 
import { requirePermission } from '../../middleware/permission.middleware.js';

export const attendanceRouter = Router();


attendanceRouter.use(authMiddleware);

// Employee route: get own attendance history
attendanceRouter.get('/my', attendanceController.getMyAttendance);

// Employee route: punch out
attendanceRouter.post('/punch-out', attendanceController.punchOut);

// Admin & Manager route: view full organization attendance
attendanceRouter.get('/', attendanceController.getAttendanceList);