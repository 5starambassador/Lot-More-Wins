import { EmailProvider } from './email-provider';
import { WhatsAppProvider } from './whatsapp-provider';
import { envMessagingMode, getStoredMessagingMode } from '../settings';
import type { MessagingMode, SendOtpOptions, SendInvoiceOptions, MessagingResult } from './types';

export * from './types';

/** Returns the persisted mode, or null when none has been saved yet. */
export type MessagingModeResolver = () => Promise<MessagingMode | null>;

export class MessagingService {
  private emailProvider: EmailProvider;
  private whatsappProvider: WhatsAppProvider;
  private resolveStoredMode: MessagingModeResolver;

  constructor(resolveStoredMode: MessagingModeResolver = getStoredMessagingMode) {
    this.emailProvider = new EmailProvider();
    this.whatsappProvider = new WhatsAppProvider();
    this.resolveStoredMode = resolveStoredMode;
  }

  /**
   * Single source of authority for messaging routing: the Super Admin setting stored
   * in the database. MESSAGING_MODE is only the fallback when no setting exists.
   */
  public async getMode(): Promise<MessagingMode> {
    return (await this.resolveStoredMode()) ?? envMessagingMode();
  }

  /**
   * Service 1: Partner Registration OTP
   * Routed strictly according to the runtime messaging mode. A caller that has already read
   * the mode passes it in to save the lookup.
   */
  public async sendRegistrationOtp(options: SendOtpOptions, knownMode?: MessagingMode): Promise<MessagingResult> {
    const mode = knownMode ?? (await this.getMode());

    if (mode === 'whatsapp') {
      return this.whatsappProvider.sendOtp(options);
    }

    return this.emailProvider.sendOtp(options);
  }

  /**
   * Service 2: Invoice + Partner App Download Link
   * Routed strictly according to the runtime messaging mode (never mixed)
   */
  public async sendInvoiceAndDownloadLink(options: SendInvoiceOptions): Promise<MessagingResult> {
    const mode = await this.getMode();

    if (mode === 'whatsapp') {
      return this.whatsappProvider.sendInvoice(options);
    }

    return this.emailProvider.sendInvoice(options);
  }
}

// Singleton instance for server-side use
export const messagingService = new MessagingService();
export default messagingService;
