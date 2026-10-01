import { Router } from 'express';
import { taskController } from './task.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { validateRequest } from '../../middleware/validate.middleware.js';
import { CreateTaskSchema, UpdateTaskSchema, TaskFilterQuerySchema } from './task.validators.js';
import { PERMISSION_KEYS } from '../../config/constants.js';

export const taskRouter = Router();

taskRouter.use(authMiddleware, tenantMiddleware);

taskRouter.post(
  '/',
  requirePermission(PERMISSION_KEYS.TASK_MANAGE),
  validateRequest({ body: CreateTaskSchema }),
  taskController.createTask
);

taskRouter.get(
  '/',
  requirePermission(PERMISSION_KEYS.TASK_MANAGE),
  validateRequest({ query: TaskFilterQuerySchema }),
  taskController.getTasks
);

taskRouter.get(
  '/overdue',
  requirePermission(PERMISSION_KEYS.TASK_MANAGE),
  taskController.getOverdueTasks
);

taskRouter.patch(
  '/:id',
  requirePermission(PERMISSION_KEYS.TASK_MANAGE),
  validateRequest({ body: UpdateTaskSchema }),
  taskController.updateTask
);

taskRouter.delete(
  '/:id',
  requirePermission(PERMISSION_KEYS.TASK_MANAGE),
  taskController.deleteTask
);
