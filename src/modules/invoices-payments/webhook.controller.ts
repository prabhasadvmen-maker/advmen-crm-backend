import { Request, Response } from 'express';
import { invoiceService } from './invoice.service.js';
import { paymentProvider } from './payment.provider.js';
import { logger } from '../../shared/logger/logger.js';
import { env } from '../../config/env.js';

export class WebhookController {
  async handleStripeWebhook(req: Request, res: Response): Promise<void> {
    const signature = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';

    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    if (env.NODE_ENV === 'production') {
      const isValid = paymentProvider.verifyStripeSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        logger.warn('⚠️ Rejected invalid Stripe webhook signature');
        res.status(400).json({ error: 'Invalid webhook signature' });
        return;
      }
    }

    const event = req.body;
    logger.info(`📥 Stripe Webhook Received: ${event.type || 'payment_intent.succeeded'}`);

    if (event.type === 'payment_intent.succeeded' || event.type === 'checkout.session.completed') {
      const metadata = event.data?.object?.metadata || {};
      const invoiceId = metadata.invoiceId || event.data?.object?.id;
      const organizationId = metadata.organizationId || 'org_acme_corp';

      if (invoiceId) {
        await invoiceService.recordPayment(organizationId, invoiceId, {
          paymentId: event.data?.object?.id || `stripe_${Date.now()}`,
          paymentProvider: 'stripe',
          idempotencyKey: `idem_${event.id || Date.now()}`,
        }).catch((err) => logger.warn(`Webhook payment record note: ${err.message}`));
      }
    }

    res.status(200).json({ received: true });
  }

  async handleRazorpayWebhook(req: Request, res: Response): Promise<void> {
    const signature = req.headers['x-razorpay-signature'] as string;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_test_secret';

    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    if (env.NODE_ENV === 'production') {
      const isValid = paymentProvider.verifyRazorpaySignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        logger.warn('⚠️ Rejected invalid Razorpay webhook signature');
        res.status(400).json({ error: 'Invalid webhook signature' });
        return;
      }
    }

    const event = req.body;
    logger.info(`📥 Razorpay Webhook Received: ${event.event || 'payment.captured'}`);

    if (event.event === 'payment.captured') {
      const notes = event.payload?.payment?.entity?.notes || {};
      const invoiceId = notes.invoiceId;
      const organizationId = notes.organizationId || 'org_acme_corp';

      if (invoiceId) {
        await invoiceService.recordPayment(organizationId, invoiceId, {
          paymentId: event.payload?.payment?.entity?.id || `rzp_${Date.now()}`,
          paymentProvider: 'razorpay',
          idempotencyKey: `idem_${event.payload?.payment?.entity?.id || Date.now()}`,
        }).catch((err) => logger.warn(`Webhook payment record note: ${err.message}`));
      }
    }

    res.status(200).json({ status: 'ok' });
  }
}

export const webhookController = new WebhookController();
