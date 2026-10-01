import { Router } from 'express';
import { invoiceController } from './invoice.controller.js';
import { webhookController } from './webhook.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { validateRequest } from '../../middleware/validate.middleware.js';
import { CreateInvoiceSchema, RecordPaymentSchema, InvoiceFilterQuerySchema } from './invoice.validators.js';
import { PERMISSION_KEYS } from '../../config/constants.js';

export const invoiceRouter = Router();

// Public Webhooks for Payment Gateway Providers (Server-to-Server)
invoiceRouter.post('/webhooks/stripe', webhookController.handleStripeWebhook);
invoiceRouter.post('/webhooks/razorpay', webhookController.handleRazorpayWebhook);

// Protected Tenant & Authenticated Routes
invoiceRouter.use(authMiddleware, tenantMiddleware);

invoiceRouter.post(
  '/',
  requirePermission(PERMISSION_KEYS.INVOICE_MANAGE),
  validateRequest({ body: CreateInvoiceSchema }),
  invoiceController.createInvoice
);

invoiceRouter.get(
  '/',
  requirePermission(PERMISSION_KEYS.PAYMENT_VIEW),
  validateRequest({ query: InvoiceFilterQuerySchema }),
  invoiceController.getInvoices
);

invoiceRouter.get(
  '/metrics',
  requirePermission(PERMISSION_KEYS.PAYMENT_VIEW),
  invoiceController.getRevenueMetrics
);

invoiceRouter.get(
  '/:id',
  requirePermission(PERMISSION_KEYS.PAYMENT_VIEW),
  invoiceController.getInvoiceById
);

invoiceRouter.post(
  '/:id/pay',
  requirePermission(PERMISSION_KEYS.PAYMENT_MANAGE),
  validateRequest({ body: RecordPaymentSchema }),
  invoiceController.recordPayment
);

invoiceRouter.delete(
  '/:id',
  requirePermission(PERMISSION_KEYS.INVOICE_MANAGE),
  invoiceController.deleteInvoice
);
