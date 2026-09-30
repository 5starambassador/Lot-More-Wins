import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { promises as dns } from 'dns';
import type { SendOtpOptions, SendInvoiceOptions, MessagingResult } from './types';

export class EmailProvider {
  private transporter: Transporter | null = null;
  private isInitializing: Promise<Transporter | null> | null = null;
  /** True when the cached transporter targets a resolved IPv6 address rather than the hostname. */
  private pinnedToIp = false;
  /** Set after the pinned IPv6 route fails; later transporters connect by hostname. */
  private useHostnameOnly = false;

  private getFromAddress(): string {
    return process.env.SMTP_FROM || `"Lot More Wins" <${process.env.SMTP_USER || 'notifications@lotmorewins.com'}>`;
  }

  /**
   * Lazily initializes and caches the Nodemailer transporter.
   * Dynamically handles IPv6 resolution for Gmail SMTP to prevent ISP-level IPv4 timeouts.
   */
  private async getTransporter(): Promise<Transporter | null> {
    if (this.transporter) {
      return this.transporter;
    }

    if (this.isInitializing) {
      return this.isInitializing;
    }

    this.isInitializing = (async () => {
      const host = process.env.SMTP_HOST || 'smtp.gmail.com';
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '') : undefined;
      const port = Number(process.env.SMTP_PORT) || 465;
      const secure = port === 465;

      if (!user || !pass) {
        return null;
      }

      let targetHost = host;

      // When connecting to Gmail SMTP, resolve IPv6 if preferred by ISP network routing
      if (host.includes('gmail') && !this.useHostnameOnly) {
        try {
          const addrs = await dns.resolve6(host);
          if (addrs && addrs.length > 0) {
            targetHost = addrs[0];
          }
        } catch {
          // Fall back to original host if IPv6 lookup is not available
          targetHost = host;
        }
      }

      const transport = nodemailer.createTransport({
        host: targetHost,
        port,
        secure,
        tls: {
          servername: host,
        },
        auth: {
          user,
          pass,
        },
      });

      this.transporter = transport;
      this.pinnedToIp = targetHost !== host;
      return transport;
    })();

    return this.isInitializing;
  }

  /**
   * Sends through the cached transporter. If the pinned IPv6 route is unreachable, the
   * transporter is rebuilt once against the hostname (letting the OS pick IPv4) and retried.
   */
  private async sendMail(transporter: Transporter, message: Parameters<Transporter['sendMail']>[0]) {
    try {
      return await transporter.sendMail(message);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      const networkFailure = ['ENETUNREACH', 'EHOSTUNREACH', 'ECONNREFUSED', 'ETIMEDOUT', 'ESOCKET', 'ECONNECTION'].includes(code ?? '');
      if (!this.pinnedToIp || !networkFailure) throw err;

      console.warn(`[EmailProvider] IPv6 SMTP route failed (${code}); retrying via hostname`);
      this.useHostnameOnly = true;
      this.transporter = null;
      this.isInitializing = null;
      const fallback = await this.getTransporter();
      if (!fallback) throw err;
      return fallback.sendMail(message);
    }
  }

  /**
   * Service 1: Partner Registration OTP Email
   */
  public async sendOtp(options: SendOtpOptions): Promise<MessagingResult> {
    const { to, name = 'Partner', otp } = options;
    const transporter = await this.getTransporter();
    const from = this.getFromAddress();

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Lot More Wins — Verification Code</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #030712; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #030712; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 500px; background-color: #090d16; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                <!-- Header -->
                <tr>
                  <td style="padding: 32px 32px 16px; text-align: center; border-bottom: 1px solid #1e293b;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                      LOT MORE <span style="color: #4ade80;">WINS</span>
                    </h1>
                    <p style="margin: 6px 0 0; color: #94a3b8; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">
                      Partner Onboarding
                    </p>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 32px;">
                    <p style="margin: 0 0 16px; color: #e2e8f0; font-size: 16px; line-height: 24px;">
                      Hello <strong>${name}</strong>,
                    </p>
                    <p style="margin: 0 0 24px; color: #94a3b8; font-size: 14px; line-height: 22px;">
                      Use the following one-time verification code to complete your partner registration.
                    </p>

                    <!-- OTP Code Card -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
                      <tr>
                        <td align="center" style="background-color: #022c22; border: 2px dashed #059669; border-radius: 12px; padding: 20px;">
                          <span style="font-size: 36px; font-weight: 800; color: #34d399; letter-spacing: 8px; font-family: monospace;">
                            ${otp}
                          </span>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 20px 0 0; color: #64748b; font-size: 13px; line-height: 20px;">
                      ⏱ This code is valid for <strong>10 minutes</strong>. Never share this code with anyone.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #030712; padding: 20px 32px; border-top: 1px solid #1e293b; text-align: center;">
                    <p style="margin: 0; color: #475569; font-size: 12px;">
                      © ${new Date().getFullYear()} Lot More Wins. Achariya Educational Public Trust.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    if (transporter) {
      try {
        const info = await this.sendMail(transporter, {
          from,
          to,
          subject: `${otp} is your Lot More Wins Partner verification code`,
          text: `Hello ${name},\n\nYour Lot More Wins registration verification code is: ${otp}\n\nThis code expires in 10 minutes.`,
          html,
        });

        console.log(`[EmailProvider:Success] Live OTP email sent to ${to} | MessageId: ${info.messageId}`);
        return {
          success: true,
          channel: 'email',
          messageId: info.messageId,
          recipient: to,
        };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[EmailProvider:Error] Failed to send real OTP email to ${to}:`, errorMsg);

        // Fallback for development if live send encounters network/delivery failure
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[MessagingService:Email (Dev Fallback)] To: ${to} | OTP: ${otp}`);
          return {
            success: true,
            channel: 'email',
            recipient: to,
            devNotice: `Live SMTP attempted but failed (${errorMsg}), simulated OTP: ${otp}`,
          };
        }

        return { success: false, channel: 'email', recipient: to, error: errorMsg };
      }
    }

    // Fallback if SMTP credentials are missing in dev environment
    console.log(`[MessagingService:Email (Dev Mode)] To: ${to} | OTP: ${otp}`);
    return {
      success: true,
      channel: 'email',
      messageId: `dev-email-${Date.now()}`,
      recipient: to,
      devNotice: `SMTP credentials not configured. OTP: ${otp}`,
    };
  }

  /**
   * Service 2: Invoice + Partner App Download Link Email
   */
  public async sendInvoice(options: SendInvoiceOptions): Promise<MessagingResult> {
    const { to, billNumber, subtotal, totalAmount, discountAmount, pointsEarned, pointsPending, downloadLink } = options;
    const name = escapeHtml(options.name);
    const outletName = escapeHtml(options.outletName);
    const transporter = await this.getTransporter();
    const from = this.getFromAddress();
    const inr = (v: number) => `₹${v.toFixed(2)}`;
    const pointsNote = pointsPending
      ? 'Register in the Lot More Wins partner app with this mobile number to claim your points.'
      : 'Your points have been added to your Lot More Wins wallet.';

    const row = (label: string, value: string, color: string, last = false) => `
                      <tr>
                        <td style="padding: 16px 20px; ${last ? '' : 'border-bottom: 1px solid #1e293b; '}color: #94a3b8; font-size: 14px;">${label}</td>
                        <td align="right" style="padding: 16px 20px; ${last ? '' : 'border-bottom: 1px solid #1e293b; '}color: ${color}; font-size: 16px; font-weight: 700;">${value}</td>
                      </tr>`;

    const cta = downloadLink
      ? `
                    <div style="background-color: #022c22; border: 1px solid #059669; border-radius: 12px; padding: 24px; text-align: center;">
                      <h3 style="margin: 0 0 8px; color: #34d399; font-size: 16px; font-weight: 700;">
                        Download the Lot More Wins Partner App
                      </h3>
                      <p style="margin: 0 0 20px; color: #a7f3d0; font-size: 13px; line-height: 19px;">
                        ${pointsNote} Get your own discount and referral QR codes to share with friends and family.
                      </p>
                      <a href="${escapeHtml(downloadLink)}" style="background-color: #10b981; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 700; display: inline-block; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);">
                        Download Partner App &rarr;
                      </a>
                    </div>`
      : `
                    <p style="margin: 0; color: #a7f3d0; font-size: 13px; line-height: 19px; text-align: center;">${pointsNote}</p>`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Lot More Wins — Invoice #${billNumber}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #030712; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #030712; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #090d16; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                <tr>
                  <td style="padding: 32px 32px 20px; text-align: center; border-bottom: 1px solid #1e293b; background: linear-gradient(180deg, #0f172a 0%, #090d16 100%);">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff;">
                      LOT MORE <span style="color: #4ade80;">WINS</span>
                    </h1>
                    <p style="margin: 6px 0 0; color: #94a3b8; font-size: 13px; font-weight: 500;">
                      ${outletName} • Bill #${billNumber}
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 32px;">
                    <p style="margin: 0 0 12px; color: #e2e8f0; font-size: 16px;">
                      Hello <strong>${name}</strong>,
                    </p>
                    <p style="margin: 0 0 24px; color: #94a3b8; font-size: 14px; line-height: 22px;">
                      Thank you for your visit to ${outletName}! Here is your bill summary with your savings and rewards:
                    </p>
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; border: 1px solid #1e293b; border-radius: 12px; margin-bottom: 28px;">
                      ${row('Bill Amount', inr(subtotal), '#ffffff')}
                      ${row('Discount Saved', `- ${inr(discountAmount)}`, '#4ade80')}
                      ${row('Amount Paid', inr(totalAmount), '#ffffff')}
                      ${row('Purchase Points Earned', `+${pointsEarned} pts`, '#fbbf24', true)}
                    </table>
                    ${cta}
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #030712; padding: 20px 32px; border-top: 1px solid #1e293b; text-align: center;">
                    <p style="margin: 0; color: #475569; font-size: 12px;">
                      © ${new Date().getFullYear()} Lot More Wins. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const text =
      `Hello ${options.name},\n\nYour bill summary at ${options.outletName} (#${billNumber}):\n` +
      `Bill Amount: ${inr(subtotal)}\nDiscount Saved: ${inr(discountAmount)}\nAmount Paid: ${inr(totalAmount)}\n` +
      `Purchase Points Earned: ${pointsEarned}\n${pointsNote}\n` +
      (downloadLink ? `\nDownload the Lot More Wins Partner App: ${downloadLink}\n` : '');

    if (transporter) {
      try {
        const info = await this.sendMail(transporter, {
          from,
          to,
          subject: `Your bill #${billNumber} at ${options.outletName} — Lot More Wins`,
          text,
          html,
        });

        console.log(`[EmailProvider:Success] Live Invoice email sent to ${to} | MessageId: ${info.messageId}`);
        return { success: true, channel: 'email', messageId: info.messageId, recipient: to };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[EmailProvider:Error] Failed to send invoice email to ${to}:`, errorMsg);
        return { success: false, channel: 'email', recipient: to, error: errorMsg };
      }
    }

    console.log(`[MessagingService:Email (Dev Mode)] Invoice to: ${to} for Bill #${billNumber}`);
    return {
      success: true,
      channel: 'email',
      messageId: `dev-email-inv-${Date.now()}`,
      recipient: to,
    };
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
