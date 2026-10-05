import { Router } from 'express';
import { attendanceController } from './attendance.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js'; 

export const attendanceRouter = Router();


attendanceRouter.use(authMiddleware);

// Employee route: get own attendance history
attendanceRouter.get('/my', attendanceController.getMyAttendance);

// Employee route: punch out
attendanceRouter.post('/punch-out', attendanceController.punchOut);

// Administrator route: view employee attendance and login history
attendanceRouter.get('/', attendanceController.getAttendanceList);

// Administrator route: force logout / punch out an employee
attendanceRouter.post('/force-logout', attendanceController.adminForceLogout);

// Administrator route: manual sync with external attendance app
attendanceRouter.post('/sync', attendanceController.syncExternalAttendance);

// Administrator route: clear all attendance records
attendanceRouter.delete('/clear-all', attendanceController.clearAll);

// Administrator route: delete a single attendance record by ID
attendanceRouter.delete('/:id', attendanceController.deleteRecord);