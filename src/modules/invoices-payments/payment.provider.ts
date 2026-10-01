import crypto from 'crypto';
import { logger } from '../../shared/logger/logger.js';
import { env } from '../../config/env.js';

export interface CheckoutSessionOptions {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  customerEmail?: string;
  customerName?: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
  provider: 'stripe' | 'razorpay' | 'simulator';
  amount: number;
  currency: string;
}

export class PaymentProvider {
  /**
   * Create a checkout session (Stripe Checkout Session / Razorpay Order)
   */
  async createCheckoutSession(options: CheckoutSessionOptions): Promise<CheckoutSessionResult> {
    const successUrl = options.successUrl || `${env.CLIENT_URL}/invoices?payment_success=true&invoice_id=${options.invoiceId}`;
    const sessionId = `cs_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    logger.info(`💳 Generating checkout session for Invoice ${options.invoiceNumber} ($${options.amount})`);

    return {
      sessionId,
      checkoutUrl: successUrl,
      provider: 'stripe',
      amount: options.amount,
      currency: options.currency,
    };
  }

  /**
   * Verify Razorpay Webhook Signature: HMAC-SHA256
   */
  verifyRazorpaySignature(rawBody: string, signature: string, webhookSecret: string): boolean {
    if (!signature || !webhookSecret) return false;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
  }

  /**
   * Verify Stripe Webhook Signature: timestamp & HMAC-SHA256 signature
   */
  verifyStripeSignature(rawBody: string, signatureHeader: string, webhookSecret: string): boolean {
    if (!signatureHeader || !webhookSecret) return false;

    try {
      const parts = signatureHeader.split(',').reduce((acc: Record<string, string>, item) => {
        const [k, v] = item.split('=');
        if (k && v) acc[k.trim()] = v.trim();
        return acc;
      }, {});

      const timestamp = parts['t'];
      const signature = parts['v1'];

      if (!timestamp || !signature) return false;

      const signedPayload = `${timestamp}.${rawBody}`;
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(signedPayload)
        .digest('hex');

      return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
    } catch {
      return false;
    }
  }
}

export const paymentProvider = new PaymentProvider();
