import { Router } from 'express';
import { organizationController } from './organization.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { validateRequest } from '../../middleware/validate.middleware.js';
import { CreateOrganizationSchema, UpdateOrganizationSettingsSchema } from './organization.validators.js';

export const organizationRouter = Router();

// Public route for unauthenticated workspace selection on login / signup
organizationRouter.get('/public', organizationController.getPublicOrganizations);

// Authenticated routes
organizationRouter.use(authMiddleware);

organizationRouter.get('/', organizationController.getOrganizations);
organizationRouter.get('/dashboard-stats', organizationController.getDashboardStats);
organizationRouter.put(
  '/:id/settings',
  validateRequest({ body: UpdateOrganizationSettingsSchema }),
  organizationController.updateOrganizationSettings
);
organizationRouter.get('/:id', organizationController.getOrganizationById);
organizationRouter.post(
  '/',
  validateRequest({ body: CreateOrganizationSchema }),
  organizationController.createOrganization
);
organizationRouter.delete('/:id', organizationController.deleteOrganization);
