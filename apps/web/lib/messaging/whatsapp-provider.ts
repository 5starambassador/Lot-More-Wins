import type { SendOtpOptions, SendInvoiceOptions, MessagingResult } from './types';

export class WhatsAppProvider {
  private authKey?: string;
  private integratedNumber?: string;
  private otpTemplate: string;
  private invoiceTemplate: string;

  constructor() {
    this.authKey = process.env.MSG91_AUTH_KEY;
    this.integratedNumber = process.env.MSG91_INTEGRATED_NUMBER;
    this.otpTemplate = process.env.MSG91_OTP_TEMPLATE_NAME || 'lotmorewins_otp';
    this.invoiceTemplate = process.env.MSG91_INVOICE_TEMPLATE_NAME || 'lotmorewins_invoice';
  }

  private formatMobileNumber(raw: string): string {
    const cleaned = raw.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `91${cleaned}`;
    }
    return cleaned;
  }

  public async sendOtp(options: SendOtpOptions): Promise<MessagingResult> {
    const { to, otp } = options;
    const mobile = this.formatMobileNumber(to);

    if (this.authKey && this.integratedNumber) {
      try {
        const payload = {
          integrated_number: this.integratedNumber,
          content_type: 'template',
          payload: {
            to: mobile,
            type: 'template',
            template: {
              name: this.otpTemplate,
              language: {
                code: 'en',
                policy: 'deterministic',
              },
              components: [
                {
                  type: 'body',
                  parameters: [
                    {
                      type: 'text',
                      text: otp,
                    },
                  ],
                },
                {
                  type: 'button',
                  sub_type: 'url',
                  index: '0',
                  parameters: [
                    {
                      type: 'text',
                      text: otp,
                    },
                  ],
                },
              ],
            },
          },
        };

        const res = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            authkey: this.authKey,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || `MSG91 Error: ${res.statusText}`);
        }

        return {
          success: true,
          channel: 'whatsapp',
          messageId: data.request_id || `msg91-${Date.now()}`,
          recipient: mobile,
        };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('WhatsAppProvider MSG91 error:', errorMsg);
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[MessagingService:MSG91-WhatsApp (Fallback Log)] To: ${mobile} | OTP: ${otp}`);
          return {
            success: true,
            channel: 'whatsapp',
            recipient: mobile,
            devNotice: `Live MSG91 failed (${errorMsg}), OTP logged: ${otp}`,
          };
        }
        return { success: false, channel: 'whatsapp', recipient: mobile, error: errorMsg };
      }
    }

    // Development / simulated mode
    console.log(`[MessagingService:MSG91-WhatsApp (Dev Mode)] To: ${mobile} | OTP: ${otp}`);
    return {
      success: true,
      channel: 'whatsapp',
      messageId: `dev-msg91-${Date.now()}`,
      recipient: mobile,
      devNotice: `MSG91 not configured. OTP: ${otp}`,
    };
  }

  /**
   * Invoice template body parameters, in order (the MSG91 template must match):
   * {{1}} name, {{2}} outlet, {{3}} bill number, {{4}} bill amount, {{5}} discount,
   * {{6}} amount paid, {{7}} points earned, {{8}} points note, {{9}} app download link.
   */
  public async sendInvoice(options: SendInvoiceOptions): Promise<MessagingResult> {
    const { to, name, outletName, billNumber, subtotal, totalAmount, discountAmount, pointsEarned, pointsPending } =
      options;
    const downloadLink = options.downloadLink || 'Search "Lot More Wins" on Google Play';
    const pointsNote = pointsPending
      ? 'Register in the Lot More Wins partner app with this mobile number to claim them.'
      : 'They have been added to your Lot More Wins wallet.';
    const inr = (v: number) => `₹${v.toFixed(2)}`;
    const mobile = this.formatMobileNumber(to);

    if (this.authKey && this.integratedNumber) {
      try {
        const payload = {
          integrated_number: this.integratedNumber,
          content_type: 'template',
          payload: {
            to: mobile,
            type: 'template',
            template: {
              name: this.invoiceTemplate,
              language: { code: 'en', policy: 'deterministic' },
              components: [
                {
                  type: 'body',
                  parameters: [
                    { type: 'text', text: name },
                    { type: 'text', text: outletName },
                    { type: 'text', text: billNumber },
                    { type: 'text', text: inr(subtotal) },
                    { type: 'text', text: inr(discountAmount) },
                    { type: 'text', text: inr(totalAmount) },
                    { type: 'text', text: String(pointsEarned) },
                    { type: 'text', text: pointsNote },
                    { type: 'text', text: downloadLink },
                  ],
                },
              ],
            },
          },
        };

        const res = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            authkey: this.authKey,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return {
            success: false,
            channel: 'whatsapp',
            recipient: mobile,
            error: data.message || `MSG91 Error: ${res.status} ${res.statusText}`,
          };
        }
        return {
          success: true,
          channel: 'whatsapp',
          messageId: data.request_id || `msg91-inv-${Date.now()}`,
          recipient: mobile,
        };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return { success: false, channel: 'whatsapp', recipient: mobile, error: errorMsg };
      }
    }

    console.log(
      `[MessagingService:MSG91-WhatsApp (Dev Mode)] Invoice to: ${mobile} for Bill #${billNumber} at ${outletName}, ` +
        `Paid: ${inr(totalAmount)}, Points: ${pointsEarned}${pointsPending ? ' (pending)' : ''}, Download: ${downloadLink}`
    );
    return {
      success: true,
      channel: 'whatsapp',
      messageId: `dev-msg91-inv-${Date.now()}`,
      recipient: mobile,
    };
  }
}
