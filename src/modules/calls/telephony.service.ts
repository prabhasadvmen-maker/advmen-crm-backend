import crypto from 'crypto';
import { logger } from '../../shared/logger/logger.js';

export interface TelephonyTokenResult {
  token: string;
  identity: string;
  expiresInSeconds: number;
  provider: 'twilio' | 'webrtc-simulator';
}

export class TelephonyService {
  /**
   * Generates a voice capability token for browser WebRTC dialer
   */
  generateVoiceToken(userId: string, organizationId: string): TelephonyTokenResult {
    const identity = `user_${organizationId}_${userId}`;
    const token = `voice_token_${crypto.randomBytes(16).toString('hex')}`;

    logger.debug(`📞 Generated voice capability token for ${identity}`);

    return {
      token,
      identity,
      expiresInSeconds: 3600,
      provider: process.env.TWILIO_ACCOUNT_SID ? 'twilio' : 'webrtc-simulator',
    };
  }

  /**
   * Validates Twilio Webhook Signature (X-Twilio-Signature)
   */
  validateTwilioSignature(
    url: string,
    params: Record<string, string>,
    expectedSignature: string,
    authToken: string
  ): boolean {
    if (!expectedSignature || !authToken) return false;

    // Twilio signature format: URL + sorted key-value pairs hashed with HMAC-SHA1
    const sortedKeys = Object.keys(params).sort();
    let data = url;
    for (const key of sortedKeys) {
      data += `${key}${params[key]}`;
    }

    const calculated = crypto
      .createHmac('sha1', authToken)
      .update(Buffer.from(data, 'utf-8'))
      .digest('base64');

    return calculated === expectedSignature;
  }
}

export const telephonyService = new TelephonyService();
