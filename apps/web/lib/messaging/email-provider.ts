import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { promises as dns } from 'dns';
import type { SendOtpOptions, SendInvoiceOptions, MessagingResult } from './types';

/** How the SMTP server is reached: by hostname (IPv4) or by its resolved IPv6 address. */
type SmtpRoute = 'hostname' | 'ipv6';

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

/**
 * Delivery is retried within one request. The Partner App waits 15s for a response, so new
 * attempts stop being started once RETRY_BUDGET_MS has passed.
 */
const MAX_ATTEMPTS = 4;
const RETRY_BUDGET_MS = 9_000;
const RETRY_DELAY_MS = 400;
const IPV6_LOOKUP_TIMEOUT_MS = 2_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * - permanent: the server refused the message or the credentials (5xx); retrying cannot help.
 * - throttled: a temporary SMTP refusal (4xx), e.g. Gmail's "too many login attempts".
 * - network: the connection failed or dropped; worth trying again, on the other route if any.
 */
function classifySmtpError(err: unknown): 'permanent' | 'throttled' | 'network' {
  const { code, responseCode } = err as { code?: string; responseCode?: number };
  if (responseCode && responseCode >= 400 && responseCode < 500) return 'throttled';
  if ((responseCode && responseCode >= 500) || code === 'EAUTH' || code === 'EENVELOPE') return 'permanent';
  return 'network';
}

export class EmailProvider {
  /** One pooled transporter per route, reused by every send on this server instance. */
  private transporters = new Map<SmtpRoute, Transporter>();
  /** The route the last successful send used; tried first from then on. */
  private preferredRoute: SmtpRoute | null = null;
  private ipv6Lookup: Promise<string | null> | null = null;

  private getFromAddress(): string {
    return process.env.SMTP_FROM || `"Lot More Wins" <${process.env.SMTP_USER || 'notifications@lotmorewins.com'}>`;
  }

  /** SMTP settings from the environment, or null when no credentials are configured. */
  private smtpConfig(): SmtpConfig | null {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '') : undefined;
    if (!user || !pass) return null;
    return {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 465,
      user,
      pass,
    };
  }

  /** The host's IPv6 address, for networks whose IPv4 route to Gmail SMTP times out. Null when unavailable. */
  private resolveIpv6(host: string): Promise<string | null> {
    if (!this.ipv6Lookup) {
      this.ipv6Lookup = Promise.race([
        dns.resolve6(host).then((addrs) => addrs[0] ?? null),
        sleep(IPV6_LOOKUP_TIMEOUT_MS).then(() => null),
      ]).catch(() => null);
    }
    return this.ipv6Lookup;
  }

  /**
   * Routes to try, best first. Hosting platforms reach Gmail over IPv4, so production starts with
   * the hostname; a development machine starts with IPv6. Whichever route delivers is remembered.
   */
  private routeOrder(host: string): SmtpRoute[] {
    if (!host.includes('gmail')) return ['hostname'];
    const first: SmtpRoute = this.preferredRoute ?? (process.env.NODE_ENV === 'production' ? 'hostname' : 'ipv6');
    return first === 'hostname' ? ['hostname', 'ipv6'] : ['ipv6', 'hostname'];
  }

  private async transporterFor(route: SmtpRoute, config: SmtpConfig): Promise<Transporter> {
    const cached = this.transporters.get(route);
    if (cached) return cached;

    // Without an IPv6 address the "ipv6" route is simply a second connection by hostname.
    const target = (route === 'ipv6' && (await this.resolveIpv6(config.host))) || config.host;
    const transport = nodemailer.createTransport({
      host: target,
      port: config.port,
      secure: config.port === 465,
      // Connections are kept open and reused, so a burst of sends does not sign in once per email
      // (Gmail throttles frequent sign-ins). A broken connection is replaced by the pool.
      pool: true,
      maxConnections: 5,
      maxMessages: 50,
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      socketTimeout: 10_000,
      tls: {
        servername: config.host,
      },
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

    this.transporters.set(route, transport);
    return transport;
  }

  /**
   * Sends one message, retrying temporary failures: a dropped or unreachable connection moves to
   * the other route, a temporary refusal by the server is retried after a short pause. Throws the
   * last error once the attempts or the time budget run out, or at once when it is permanent.
   */
  private async deliver(config: SmtpConfig, message: Parameters<Transporter['sendMail']>[0]) {
    const startedAt = Date.now();
    const routes = this.routeOrder(config.host);
    let routeIndex = 0;

    for (let attempt = 1; ; attempt++) {
      const route = routes[routeIndex % routes.length];
      try {
        const transporter = await this.transporterFor(route, config);
        const info = await transporter.sendMail(message);
        this.preferredRoute = route;
        return info;
      } catch (err: unknown) {
        const kind = classifySmtpError(err);
        const outOfTries = attempt >= MAX_ATTEMPTS || Date.now() - startedAt > RETRY_BUDGET_MS;
        if (kind === 'permanent' || outOfTries) throw err;

        const reason = (err as { code?: string }).code ?? (err instanceof Error ? err.message : String(err));
        console.warn(`[EmailProvider] Send attempt ${attempt} via ${route} failed (${reason}); retrying`);
        const switchesRoute = kind === 'network' && routes.length > 1;
        if (switchesRoute) routeIndex++;
        else await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  /**
   * Service 1: Partner Registration OTP Email
   */
  public async sendOtp(options: SendOtpOptions): Promise<MessagingResult> {
    const { to, otp } = options;
    const name = escapeHtml(options.name || 'Partner');
    const smtp = this.smtpConfig();
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

    if (smtp) {
      try {
        const info = await this.deliver(smtp, {
          from,
          to,
          subject: `${otp} is your Lot More Wins Partner verification code`,
          text: `Hello ${options.name || 'Partner'},\n\nYour Lot More Wins registration verification code is: ${otp}\n\nThis code expires in 10 minutes.`,
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
    const smtp = this.smtpConfig();
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

    if (smtp) {
      try {
        const info = await this.deliver(smtp, {
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
