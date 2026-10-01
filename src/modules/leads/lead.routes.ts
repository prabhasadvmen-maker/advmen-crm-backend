import { Router } from 'express';
import { leadController } from './lead.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { requirePermission, requireAnyPermission } from '../../middleware/permission.middleware.js';
import { validateRequest } from '../../middleware/validate.middleware.js';
import { CreateLeadSchema, UpdateLeadSchema, LeadFilterQuerySchema } from './lead.validators.js';
import { PERMISSION_KEYS } from '../../config/constants.js';
import multer from 'multer';
import { z } from 'zod';

export const leadRouter = Router();

// Apply auth and tenant middlewares to all lead routes
leadRouter.use(authMiddleware, tenantMiddleware);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
});

const ImportRowsSchema = z.object({
  rows: z.array(
    z.object({
      name: z.string().min(1),
      phone: z.string().min(1),
      email: z.string().optional(),
      company: z.string().optional(),
      title: z.string().optional(),
      city: z.string().optional(),
      source: z.string().optional(),
      requirement: z.string().optional(),
      budget: z.number().optional(),
      rowNumber: z.number(),
      customFields: z.record(z.any()).optional(),
    })
  ).min(1).max(100000),
});

const AssignSchema = z.object({
  leadIds: z.array(z.string()).min(1).max(100000),
  employeeId: z.string().min(1),
});

const DistributeQuantitySchema = z.object({
  employeeId: z.string().min(1),
  quantity: z.number().int().positive().max(100000),
});

const DistributeSchema = z.object({
  leadIds: z.array(z.string()).min(1).max(100000),
  employeeIds: z.array(z.string()).min(1).max(1000),
});

const DistributeCustomSchema = z.object({
  distribution: z.array(
    z.object({
      employeeId: z.string().min(1),
      leadIds: z.array(z.string()).min(1),
    })
  ).min(1),
});

const BulkDeleteSchema = z.object({
  leadIds: z.array(z.string()).optional(),
  status: z.string().optional(),
  statuses: z.array(z.string()).optional(),
  employeeId: z.string().optional(),
  unassignedOnly: z.boolean().optional(),
  all: z.boolean().optional(),
});

leadRouter.post('/import/preview', requirePermission(PERMISSION_KEYS.LEAD_CREATE), upload.single('file'), leadController.previewImport);
leadRouter.post('/import/commit', requirePermission(PERMISSION_KEYS.LEAD_CREATE), validateRequest({ body: ImportRowsSchema }), leadController.commitImport);
leadRouter.post('/assign-bulk', requirePermission(PERMISSION_KEYS.LEAD_ASSIGN), validateRequest({ body: AssignSchema }), leadController.assignImported);
leadRouter.post('/distribute-quantity', requirePermission(PERMISSION_KEYS.LEAD_ASSIGN), validateRequest({ body: DistributeQuantitySchema }), leadController.assignQuantity);
leadRouter.post('/distribute-evenly', requirePermission(PERMISSION_KEYS.LEAD_ASSIGN), validateRequest({ body: DistributeSchema }), leadController.distributeImported);
leadRouter.post('/distribute-custom', requirePermission(PERMISSION_KEYS.LEAD_ASSIGN), validateRequest({ body: DistributeCustomSchema }), leadController.distributeCustom);
leadRouter.get('/unassigned-summary', requireAnyPermission(PERMISSION_KEYS.LEAD_ASSIGN, PERMISSION_KEYS.LEAD_VIEW), leadController.getUnassignedSummary);
leadRouter.post('/bulk-delete/count', requirePermission(PERMISSION_KEYS.LEAD_VIEW), validateRequest({ body: BulkDeleteSchema }), leadController.getBulkDeleteCount);
leadRouter.post('/bulk-delete', requirePermission(PERMISSION_KEYS.LEAD_DELETE), validateRequest({ body: BulkDeleteSchema }), leadController.bulkDeleteLeads);

leadRouter.post(
  '/',
  requirePermission(PERMISSION_KEYS.LEAD_CREATE),
  validateRequest({ body: CreateLeadSchema }),
  leadController.createLead
);

leadRouter.get(
  '/',
  requirePermission(PERMISSION_KEYS.LEAD_VIEW),
  validateRequest({ query: LeadFilterQuerySchema }),
  leadController.getLeads
);

leadRouter.get(
  '/metrics',
  requirePermission(PERMISSION_KEYS.LEAD_VIEW),
  leadController.getMetrics
);

// Queries, finalized leads, and employee stats routes (placed before /:id)
leadRouter.get('/queries/all', leadController.getAllQueries);
leadRouter.get('/finalized/all', leadController.getFinalizedLeads);
leadRouter.get('/stats/employees', leadController.getEmployeeStats);

// Lead Query and Completion Actions
leadRouter.post('/:id/query', leadController.raiseQuery);
leadRouter.post('/:id/query/:queryId/resolve', leadController.resolveQuery);
leadRouter.post('/:id/complete', leadController.completeLead);

leadRouter.get(
  '/:id',
  requirePermission(PERMISSION_KEYS.LEAD_VIEW),
  leadController.getLeadById
);

leadRouter.patch(
  '/:id',
  requirePermission(PERMISSION_KEYS.LEAD_EDIT),
  validateRequest({ body: UpdateLeadSchema }),
  leadController.updateLead
);

leadRouter.delete(
  '/:id',
  requirePermission(PERMISSION_KEYS.LEAD_DELETE),
  leadController.deleteLead
);
