import { Router } from 'express';
import { proposalController } from './proposal.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { validateRequest } from '../../middleware/validate.middleware.js';
import { CreateProposalSchema, UpdateProposalStatusSchema } from './proposal.validators.js';
import { PERMISSION_KEYS } from '../../config/constants.js';

export const proposalRouter = Router();

proposalRouter.use(authMiddleware, tenantMiddleware);

proposalRouter.post(
  '/',
  requirePermission(PERMISSION_KEYS.PROPOSAL_MANAGE),
  validateRequest({ body: CreateProposalSchema }),
  proposalController.createProposal
);

proposalRouter.get(
  '/',
  requirePermission(PERMISSION_KEYS.PROPOSAL_MANAGE),
  proposalController.getProposals
);

proposalRouter.get(
  '/:id',
  requirePermission(PERMISSION_KEYS.PROPOSAL_MANAGE),
  proposalController.getProposalById
);

proposalRouter.patch(
  '/:id/status',
  requirePermission(PERMISSION_KEYS.PROPOSAL_MANAGE),
  validateRequest({ body: UpdateProposalStatusSchema }),
  proposalController.updateProposalStatus
);

proposalRouter.delete(
  '/:id',
  requirePermission(PERMISSION_KEYS.PROPOSAL_MANAGE),
  proposalController.deleteProposal
);
