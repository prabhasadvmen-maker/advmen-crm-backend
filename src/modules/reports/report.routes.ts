import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { PERMISSION_KEYS } from '../../config/constants.js';
import { reportController } from './report.controller.js';

export const reportRouter = Router();

reportRouter.use(authMiddleware, tenantMiddleware);
reportRouter.get(
  '/overview',
  requirePermission(PERMISSION_KEYS.REPORT_VIEW),
  reportController.getOverview
);
