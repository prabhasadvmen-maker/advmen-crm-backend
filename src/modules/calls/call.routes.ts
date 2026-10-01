import { Router } from 'express';
import { callController } from './call.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { validateRequest } from '../../middleware/validate.middleware.js';
import { LogCallSchema, CallFilterQuerySchema } from './call.validators.js';
import { PERMISSION_KEYS } from '../../config/constants.js';

export const callRouter = Router();

// Public Webhook for Telephony Status / Inbound callbacks
callRouter.post('/webhooks/voice', callController.handleVoiceWebhook);

// Protected Tenant & Authenticated Routes
callRouter.use(authMiddleware, tenantMiddleware);

callRouter.get('/token', callController.getVoiceToken);

callRouter.post(
  '/',
  requirePermission(PERMISSION_KEYS.CALL_MAKE),
  validateRequest({ body: LogCallSchema }),
  callController.logCall
);

callRouter.get(
  '/',
  requirePermission(PERMISSION_KEYS.CALL_VIEW),
  validateRequest({ query: CallFilterQuerySchema }),
  callController.getCalls
);

callRouter.get(
  '/metrics',
  requirePermission(PERMISSION_KEYS.CALL_VIEW),
  callController.getMetrics
);

callRouter.get(
  '/:id',
  requirePermission(PERMISSION_KEYS.CALL_VIEW),
  callController.getCallById
);
