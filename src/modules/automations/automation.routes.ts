import { Router } from 'express';
import { automationController } from './automation.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { PERMISSION_KEYS } from '../../config/constants.js';

export const automationRouter = Router();

automationRouter.use(authMiddleware, tenantMiddleware);

automationRouter.post(
  '/',
  requirePermission(PERMISSION_KEYS.AUTOMATION_MANAGE),
  automationController.createAutomation
);

automationRouter.get(
  '/',
  requirePermission(PERMISSION_KEYS.AUTOMATION_MANAGE),
  automationController.getAutomations
);

automationRouter.patch(
  '/:id/status',
  requirePermission(PERMISSION_KEYS.AUTOMATION_MANAGE),
  automationController.toggleAutomation
);

automationRouter.delete(
  '/:id',
  requirePermission(PERMISSION_KEYS.AUTOMATION_MANAGE),
  automationController.deleteAutomation
);
