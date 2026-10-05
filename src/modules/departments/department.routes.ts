import { Router } from 'express';
import { departmentController } from './department.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';

export const departmentRouter = Router();

departmentRouter.use(authMiddleware, tenantMiddleware);

departmentRouter.get('/', departmentController.getDepartments);
departmentRouter.post('/', departmentController.addDepartment);
