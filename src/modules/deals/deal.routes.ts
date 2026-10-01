import { Router } from 'express';
import { dealController } from './deal.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { validateRequest } from '../../middleware/validate.middleware.js';
import { CreateDealSchema, UpdateDealSchema, DealFilterQuerySchema } from './deal.validators.js';
import { PERMISSION_KEYS } from '../../config/constants.js';

export const dealRouter = Router();

dealRouter.use(authMiddleware, tenantMiddleware);

dealRouter.post(
  '/',
  requirePermission(PERMISSION_KEYS.DEAL_CREATE),
  validateRequest({ body: CreateDealSchema }),
  dealController.createDeal
);

dealRouter.get(
  '/',
  requirePermission(PERMISSION_KEYS.DEAL_VIEW),
  validateRequest({ query: DealFilterQuerySchema }),
  dealController.getDeals
);

dealRouter.get(
  '/metrics',
  requirePermission(PERMISSION_KEYS.DEAL_VIEW),
  dealController.getPipelineMetrics
);

dealRouter.get(
  '/:id',
  requirePermission(PERMISSION_KEYS.DEAL_VIEW),
  dealController.getDealById
);

dealRouter.patch(
  '/:id',
  requirePermission(PERMISSION_KEYS.DEAL_EDIT),
  validateRequest({ body: UpdateDealSchema }),
  dealController.updateDeal
);

dealRouter.delete(
  '/:id',
  requirePermission(PERMISSION_KEYS.DEAL_DELETE),
  dealController.deleteDeal
);
