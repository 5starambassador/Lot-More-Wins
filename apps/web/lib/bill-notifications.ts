import type { BillRecord } from '@lotmorewins/types';
import prisma from './prisma';
import { billInclude, serializeBill, type BillWithRelations } from './billing';
import { getProgramSettings } from './settings';
import { messagingService } from './messaging';

/**
 * Bill message (invoice + purchase points + partner app download link), sent after the
 * bill is committed so a messaging failure can never undo or block a bill.
 * Channel: the Super Admin messaging mode. Recipient: the purchasing partner on a direct
 * bill, the referred customer on a referral bill. The outcome is stored on the bill.
 */

/** RFC 2606 / 6761 reserved domains can never receive mail (used by test fixtures). */
const UNDELIVERABLE_EMAIL = /@([a-z0-9-]+\.)*(test|example|invalid|localhost)$/i;

/** Messaging must not hold the outlet admin's request open indefinitely. */
const SEND_TIMEOUT_MS = 15_000;

function recipientOf(bill: BillWithRelations) {
  if (bill.transactionType === 'DIRECT_PARTNER' && bill.partner) {
    return { name: bill.partner.name, email: bill.partner.email, mobile: bill.partner.mobile };
  }
  if (bill.customer) {
    return { name: bill.customer.name, email: bill.customer.email, mobile: bill.customer.mobile };
  }
  return null;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out after ${ms / 1000}s`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function sendBillNotification(billId: string): Promise<BillRecord> {
  const bill = await prisma.bill.findUniqueOrThrow({ where: { id: billId }, include: billInclude });
  const [settings, mode] = await Promise.all([getProgramSettings(), messagingService.getMode()]);
  const channel = mode === 'whatsapp' ? 'WHATSAPP' : 'EMAIL';
  const person = recipientOf(bill);
  const to = mode === 'whatsapp' ? person?.mobile : person?.email;

  let update: {
    notificationStatus: 'SENT' | 'FAILED' | 'SKIPPED';
    notificationRecipient: string | null;
    notificationError: string | null;
    notificationSentAt?: Date;
  };

  if (mode === 'email' && to && UNDELIVERABLE_EMAIL.test(to)) {
    update = {
      notificationStatus: 'SKIPPED',
      notificationRecipient: to,
      notificationError: 'Reserved, undeliverable email domain (.test / .example / .invalid / .localhost)',
    };
  } else if (!person || !to) {
    update = {
      notificationStatus: 'SKIPPED',
      notificationRecipient: null,
      notificationError:
        mode === 'email' ? 'No email address on file for this person (messaging mode is email)' : 'No mobile number on file',
    };
  } else {
    const record = serializeBill(bill);
    try {
      const result = await withTimeout(
        messagingService.sendInvoiceAndDownloadLink({
          to,
          name: person.name,
          outletName: bill.outlet.name,
          billNumber: bill.billNumber,
          subtotal: record.billAmount,
          discountAmount: record.discountAmount,
          totalAmount: record.finalAmount,
          pointsEarned: record.purchasePoints,
          pointsPending: record.purchasePointsRecipient === 'CUSTOMER_PENDING',
          downloadLink: settings.appDownloadUrl,
        }),
        SEND_TIMEOUT_MS
      );
      update = result.success
        ? { notificationStatus: 'SENT', notificationRecipient: to, notificationError: null, notificationSentAt: new Date() }
        : { notificationStatus: 'FAILED', notificationRecipient: to, notificationError: result.error ?? 'Delivery failed' };
    } catch (error) {
      update = {
        notificationStatus: 'FAILED',
        notificationRecipient: to,
        notificationError: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const saved = await prisma.bill.update({
    where: { id: billId },
    data: {
      ...update,
      notificationError: update.notificationError?.slice(0, 500) ?? null,
      notificationChannel: channel,
      notificationAttempts: { increment: 1 },
    },
    include: billInclude,
  });
  return serializeBill(saved);
}

/** Never throws: a messaging problem is reported on the bill, not as a failed request. */
export async function trySendBillNotification(bill: BillRecord): Promise<BillRecord> {
  try {
    return await sendBillNotification(bill.id);
  } catch (error) {
    console.error(`Bill notification for ${bill.billNumber} failed unexpectedly:`, error);
    return bill;
  }
}
