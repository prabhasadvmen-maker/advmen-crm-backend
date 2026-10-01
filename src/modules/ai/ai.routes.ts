import { Router } from 'express';
import { aiController } from './ai.controller.js';
import { PulseController } from './pulse.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { PERMISSION_KEYS } from '../../config/constants.js';

export const aiRouter = Router();

aiRouter.use(authMiddleware, tenantMiddleware);

aiRouter.post(
  '/lead-summary',
  requirePermission(PERMISSION_KEYS.AI_USE),
  aiController.generateLeadSummary
);

aiRouter.post(
  '/email-draft',
  requirePermission(PERMISSION_KEYS.AI_USE),
  aiController.generateEmailDraft
);

aiRouter.post(
  '/pipeline-audit',
  requirePermission(PERMISSION_KEYS.AI_USE),
  aiController.runPipelineAudit
);

// ADVMEN PULSE - Revenue-Recovery & Decision Intelligence Endpoints
aiRouter.get(
  '/pulse/issues',
  requirePermission(PERMISSION_KEYS.AI_USE),
  PulseController.getDetectedIssues
);

aiRouter.post(
  '/pulse/decision',
  requirePermission(PERMISSION_KEYS.AI_USE),
  PulseController.createDecision
);

aiRouter.post(
  '/pulse/execute',
  requirePermission(PERMISSION_KEYS.AI_USE),
  PulseController.executeDecision
);
