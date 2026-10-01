import nodemailer from 'nodemailer';
import { logger } from '../logger/logger.js';
import { env } from '../../config/env.js';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailDispatchResult {
  messageId: string;
  status: 'SENT' | 'SIMULATED';
  recipient: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter(): nodemailer.Transporter {
    if (this.transporter) return this.transporter;

    const smtpConfigured = env.SMTP_USER && env.SMTP_PASS &&
      !env.SMTP_USER.includes('your_gmail');

    if (smtpConfigured) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });
    } else {
      // Dev fallback: Ethereal test SMTP (emails visible at ethereal.email)
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: {
          user: 'ethereal_user@ethereal.email',
          pass: 'ethereal_pass',
        },
      });
      logger.warn('⚠️  SMTP not configured — using dev simulation mode. Set SMTP_USER / SMTP_PASS in .env to send real emails.');
    }

    return this.transporter;
  }

  async sendEmail(options: SendEmailOptions): Promise<EmailDispatchResult> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    logger.info(`📧 Sending email to ${options.to}: "${options.subject}"`);

    const smtpConfigured = env.SMTP_USER && env.SMTP_PASS &&
      !env.SMTP_USER.includes('your_gmail');

    if (!smtpConfigured) {
      // Dev mode: log OTP to console so dev can still test the flow
      logger.info(`📧 [DEV SIMULATION] Email to ${options.to} | Subject: ${options.subject}`);
      logger.info(`📧 [DEV SIMULATION] Body preview:\n${options.text || options.html.replace(/<[^>]+>/g, '')}`);
      return { messageId, status: 'SIMULATED', recipient: options.to };
    }

    try {
      const info = await this.getTransporter().sendMail({
        from: env.EMAIL_FROM,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      logger.info(`📧 Email sent: ${info.messageId}`);
      return { messageId: info.messageId || messageId, status: 'SENT', recipient: options.to };
    } catch (err) {
      logger.error(`📧 Email send failed:`, err);
      throw err;
    }
  }

  /** Send a 6-digit OTP for Super Admin password reset */
  async sendPasswordResetOtp(recipientEmail: string, otp: string, adminName: string): Promise<EmailDispatchResult> {
    return this.sendEmail({
      to: recipientEmail,
      subject: 'ADVMEN SalesOS — Super Admin Password Reset OTP',
      text: `Your password reset OTP is: ${otp}\n\nThis code expires in 10 minutes.\nIf you did not request this, please ignore this email.`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </head>
        <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" style="max-width:520px;background:#fff;border-radius:16px;border:1px solid #e4e4e7;overflow:hidden;">
                  <!-- Header -->
                  <tr>
                    <td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:28px 32px;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td>
                            <div style="display:inline-flex;align-items:center;gap:10px;">
                              <span style="color:#fff;font-size:18px;font-weight:800;letter-spacing:-0.5px;">
                                ADVMEN <span style="color:#c4b5fd;">SalesOS</span>
                              </span>
                            </div>
                            <p style="color:#ddd6fe;font-size:11px;margin:4px 0 0;font-family:monospace;">
                              Enterprise Revenue Operating System
                            </p>
                          </td>
                          <td align="right">
                            <span style="display:inline-block;background:rgba(255,255,255,0.15);color:#fff;font-size:10px;font-weight:700;padding:4px 10px;border-radius:20px;border:1px solid rgba(255,255,255,0.3);font-family:monospace;letter-spacing:1px;">
                              ROOT ACCESS
                            </span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="padding:32px;">
                      <p style="color:#71717a;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">
                        Super Admin · Password Reset
                      </p>
                      <h2 style="color:#09090b;font-size:20px;font-weight:800;margin:0 0 16px;line-height:1.3;">
                        Your One-Time Verification Code
                      </h2>
                      <p style="color:#52525b;font-size:14px;margin:0 0 28px;line-height:1.6;">
                        Hi <strong>${adminName}</strong>, you requested a password reset for your Super Admin account.
                        Use the code below to proceed. <strong>Do not share this code with anyone.</strong>
                      </p>

                      <!-- OTP Box -->
                      <div style="background:#faf5ff;border:2px dashed #a78bfa;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px;">
                        <p style="color:#7c3aed;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px;">
                          Verification Code
                        </p>
                        <div style="font-size:40px;font-weight:900;color:#6d28d9;letter-spacing:12px;font-family:'Courier New',monospace;">
                          ${otp}
                        </div>
                        <p style="color:#a78bfa;font-size:11px;margin:12px 0 0;">
                          ⏱ Expires in <strong>10 minutes</strong>
                        </p>
                      </div>

                      <!-- Warning -->
                      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin:0 0 24px;">
                        <p style="color:#dc2626;font-size:12px;margin:0;font-weight:600;">
                          🔒 Security Notice
                        </p>
                        <p style="color:#7f1d1d;font-size:12px;margin:6px 0 0;line-height:1.5;">
                          If you did not request this password reset, your account may be at risk.
                          Contact your security team immediately.
                        </p>
                      </div>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background:#f9fafb;border-top:1px solid #f4f4f5;padding:16px 32px;">
                      <p style="color:#a1a1aa;font-size:11px;margin:0;text-align:center;">
                        © 2026 ADVMEN SalesOS Inc. · Enterprise Security · This email was sent to ${recipientEmail}
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });
  }

  async sendProposalEmail(recipientEmail: string, proposalNumber: string, company: string, amount: number): Promise<EmailDispatchResult> {
    return this.sendEmail({
      to: recipientEmail,
      subject: `ADVMEN SalesOS Proposal: ${proposalNumber} for ${company}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Your ADVMEN SalesOS Proposal is Ready</h2>
          <p>Dear ${company} Team,</p>
          <p>We are pleased to present proposal <strong>${proposalNumber}</strong> for total value <strong>$${amount.toLocaleString()}</strong>.</p>
          <p>Please review your contract terms and contact your account representative with any questions.</p>
        </div>
      `,
    });
  }

  async sendPaymentReceiptEmail(recipientEmail: string, invoiceNumber: string, amount: number): Promise<EmailDispatchResult> {
    return this.sendEmail({
      to: recipientEmail,
      subject: `Payment Receipt: ${invoiceNumber}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Payment Confirmation</h2>
          <p>Thank you for your payment of <strong>$${amount.toLocaleString()}</strong> for invoice <strong>${invoiceNumber}</strong>.</p>
          <p>Status: <strong>PAID &amp; SETTLED</strong></p>
        </div>
      `,
    });
  }
}

export const emailService = new EmailService();
