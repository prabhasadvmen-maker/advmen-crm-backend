import { Router } from 'express';
import { aiController } from './ai.controller.js';
import { PulseController } from './pulse.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { PERMISSION_KEYS } from '../../config/constants.js';
import { whatsAppAutomationController } from './whatsappAutomation.controller.js';
import { validateRequest } from '../../middleware/validate.middleware.js';
import { z } from 'zod';

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

const WhatsAppBatchSchema = z.object({
  cursor: z.string().optional(),
});
const WhatsAppConsentSchema = z.object({
  status: z.enum(['GRANTED', 'REVOKED', 'OPT_OUT']),
  evidence: z.string().max(500).optional(),
});

aiRouter.get(
  '/whatsapp/consent-leads',
  requirePermission(PERMISSION_KEYS.AI_ADMIN),
  whatsAppAutomationController.searchConsentLeads
);

aiRouter.put(
  '/whatsapp/leads/:leadId/consent',
  requirePermission(PERMISSION_KEYS.AI_ADMIN),
  validateRequest({ body: WhatsAppConsentSchema }),
  whatsAppAutomationController.updateWhatsAppConsent
);

aiRouter.get(
  '/whatsapp/drafts',
  requirePermission(PERMISSION_KEYS.AI_ADMIN),
  whatsAppAutomationController.listDrafts
);

aiRouter.post(
  '/whatsapp/drafts/generate-batch',
  requirePermission(PERMISSION_KEYS.AI_ADMIN),
  validateRequest({ body: WhatsAppBatchSchema }),
  whatsAppAutomationController.generateDraftBatch
);

aiRouter.post(
  '/whatsapp/drafts/:draftId/approve-send',
  requirePermission(PERMISSION_KEYS.AI_ADMIN),
  whatsAppAutomationController.approveAndSend
);

aiRouter.post(
  '/whatsapp/drafts/:draftId/reject',
  requirePermission(PERMISSION_KEYS.AI_ADMIN),
  whatsAppAutomationController.rejectDraft
);
