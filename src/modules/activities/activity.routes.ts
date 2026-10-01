import { Router } from 'express';
import { activityController } from './activity.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { PERMISSION_KEYS } from '../../config/constants.js';

export const activityRouter = Router();

activityRouter.use(authMiddleware, tenantMiddleware);

activityRouter.get(
  '/',
  requirePermission(PERMISSION_KEYS.ACTIVITY_VIEW),
  activityController.getRecentActivities
);

activityRouter.get(
  '/:recordId',
  requirePermission(PERMISSION_KEYS.ACTIVITY_VIEW),
  activityController.getRecordTimeline
);

activityRouter.post(
  '/note',
  requirePermission(PERMISSION_KEYS.LEAD_EDIT),
  activityController.addNote
);
