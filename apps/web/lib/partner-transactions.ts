import { Prisma } from '@prisma/client';
import type {
  PartnerTransaction,
  PartnerTransactionBill,
  PartnerTransactionFilter,
  PartnerTransactionsPage,
  WalletEntryType,
} from '@lotmorewins/types';
import prisma from './prisma';
import { HttpError } from './auth';
import { createdAtRange } from './admin-insights';
import { rupeeValueOf } from './points';
import { roundOffOf } from './billing';
import { getProgramSettings } from './settings';

/**
 * The wallet page history: the partner's bills, every wallet credit (points, cashback, transfers
 * received), transfers sent and old-style redemptions, newest first, filtered by kind and IST date
 * range. Each row carries what its details page shows.
 */

type Ratio = { points: number; rupees: number };

const ENTRY_TYPES_BY_FILTER: Partial<Record<PartnerTransactionFilter, WalletEntryType[]>> = {
  PURCHASE: ['PURCHASE'],
  REFERRAL: ['REFERRAL'],
  CASHBACK: ['CASHBACK_PURCHASE', 'CASHBACK_REFERRAL', 'CASH_WALLET_MERGE'],
  RECEIVED: ['TRANSFER_IN'],
};

const billInclude = {
  outlet: { select: { name: true } },
  customer: { select: { name: true, partnerId: true } },
} satisfies Prisma.BillInclude;

type BillRow = Prisma.BillGetPayload<{ include: typeof billInclude }>;

const entryInclude = {
  bill: { include: billInclude },
  transfer: { select: { transferNumber: true, fromPartner: { select: { name: true, mobile: true } } } },
} satisfies Prisma.PointsEntryInclude;

const transferInclude = { toPartner: { select: { name: true, mobile: true } } } satisfies Prisma.WalletTransferInclude;
const redemptionInclude = { outlet: { select: { name: true } } } satisfies Prisma.PointsRedemptionInclude;

/** Bills this partner paid: as a partner (discount or redeem QR), or as a referred customer before registering. */
const ownBills = (partnerId: string): Prisma.BillWhereInput => ({ OR: [{ partnerId }, { customer: { partnerId } }] });

const n = (d: Prisma.Decimal | null | undefined) => d?.toNumber() ?? 0;

function toBill(bill: BillRow, partnerId: string): PartnerTransactionBill {
  const buyer = bill.partnerId === partnerId || bill.customer?.partnerId === partnerId;
  return {
    billNumber: bill.billNumber,
    outletName: bill.outlet.name,
    transactionType: bill.transactionType,
    role: buyer ? 'BUYER' : 'REFERRER',
    buyerName: buyer ? null : bill.customer?.name ?? null,
    isFirstTime: bill.isFirstTime,
    billAmount: n(bill.billAmount),
    discountPercentage: n(bill.discountPercentage),
    discountAmount: n(bill.discountAmount),
    birthdayBonusPercentage: n(bill.birthdayBonusPercentage),
    referralRewardPercentage: n(bill.referralRewardPercentage),
    // Bills from before GST stored no taxable amount: it equals the final amount there.
    taxableAmount: n(bill.taxableAmount ?? bill.finalAmount),
    gstPercentage: n(bill.gstPercentage),
    gstAmount: n(bill.gstAmount),
    walletRedeemPoints: n(bill.walletRedeemPoints),
    walletRedeemAmount: n(bill.walletRedeemAmount),
    roundOffAmount: n(roundOffOf(bill)),
    finalAmount: n(bill.finalAmount),
    createdAt: bill.createdAt.toISOString(),
  };
}

const blank = {
  entryType: null,
  outletName: null,
  bill: null,
  rewards: [],
  expiresAt: null,
  expired: false,
  claimedAt: null,
  counterparty: null,
  reference: null,
  redemptionBillAmount: null,
} satisfies Partial<PartnerTransaction>;

function billTransaction(
  bill: BillRow,
  rewards: { id: string; type: WalletEntryType; points: Prisma.Decimal; expiresAt: Date | null }[],
  partnerId: string,
  ratio: Ratio,
  now: Date
): PartnerTransaction {
  const redeem = bill.transactionType === 'WALLET_REDEEM';
  return {
    ...blank,
    id: `bill_${bill.id}`,
    kind: 'BILL',
    points: redeem ? -n(bill.walletRedeemPoints) : 0,
    rupeeValue: redeem ? -n(bill.walletRedeemAmount) : 0,
    createdAt: bill.createdAt.toISOString(),
    outletName: bill.outlet.name,
    bill: toBill(bill, partnerId),
    rewards: rewards.map((r) => ({
      id: r.id,
      type: r.type,
      points: r.points.toNumber(),
      rupeeValue: rupeeValueOf(r.points, ratio).toNumber(),
      expiresAt: r.expiresAt?.toISOString() ?? null,
      expired: r.expiresAt !== null && r.expiresAt <= now,
    })),
  };
}

type EntryRow = Prisma.PointsEntryGetPayload<{ include: typeof entryInclude }>;

function entryTransaction(entry: EntryRow, partnerId: string, ratio: Ratio, now: Date): PartnerTransaction {
  const from = entry.transfer?.fromPartner ?? null;
  return {
    ...blank,
    id: `entry_${entry.id}`,
    kind: 'REWARD',
    entryType: entry.type,
    points: entry.points.toNumber(),
    rupeeValue: rupeeValueOf(entry.points, ratio).toNumber(),
    createdAt: entry.createdAt.toISOString(),
    outletName: entry.bill?.outlet.name ?? null,
    bill: entry.bill ? toBill(entry.bill, partnerId) : null,
    expiresAt: entry.expiresAt?.toISOString() ?? null,
    expired: entry.expiresAt !== null && entry.expiresAt <= now,
    claimedAt: entry.claimedAt?.toISOString() ?? null,
    counterparty: from ? { name: from.name, mobile: from.mobile } : null,
    reference: entry.transfer?.transferNumber ?? null,
  };
}

type TransferRow = Prisma.WalletTransferGetPayload<{ include: typeof transferInclude }>;

function sentTransaction(t: TransferRow): PartnerTransaction {
  return {
    ...blank,
    id: `transfer_${t.id}`,
    kind: 'SENT',
    points: -t.points.toNumber(),
    rupeeValue: -t.rupeeValue.toNumber(),
    createdAt: t.createdAt.toISOString(),
    counterparty: { name: t.toPartner.name, mobile: t.toPartner.mobile },
    reference: t.transferNumber,
  };
}

type RedemptionRow = Prisma.PointsRedemptionGetPayload<{ include: typeof redemptionInclude }>;

function redemptionTransaction(r: RedemptionRow): PartnerTransaction {
  return {
    ...blank,
    id: `redemption_${r.id}`,
    kind: 'REDEEMED',
    points: -r.points.toNumber(),
    rupeeValue: -r.rupeeValue.toNumber(),
    createdAt: r.createdAt.toISOString(),
    outletName: r.outlet.name,
    redemptionBillAmount: r.billAmount?.toNumber() ?? null,
  };
}

/** Credits each bill gave this partner, for the bill rows. */
async function rewardsByBill(partnerId: string, billIds: string[]) {
  const map = new Map<string, { id: string; type: WalletEntryType; points: Prisma.Decimal; expiresAt: Date | null }[]>();
  if (billIds.length === 0) return map;
  const rows = await prisma.pointsEntry.findMany({
    where: { partnerId, billId: { in: billIds } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, type: true, points: true, expiresAt: true, billId: true },
  });
  for (const r of rows) {
    const list = map.get(r.billId!) ?? [];
    list.push(r);
    map.set(r.billId!, list);
  }
  return map;
}

export async function listPartnerTransactions(
  partnerId: string,
  query: { type: PartnerTransactionFilter; from?: string; to?: string; limit: number }
): Promise<PartnerTransactionsPage> {
  const { type, limit } = query;
  const createdAt = createdAtRange({ from: query.from, to: query.to });
  const take = limit + 1;
  const orderBy = { createdAt: 'desc' } as const;
  const now = new Date();

  const wantBills = type === 'ALL' || type === 'BILLS' || type === 'REDEEMED';
  const entryTypes = type === 'ALL' ? undefined : ENTRY_TYPES_BY_FILTER[type];
  const wantEntries = type === 'ALL' || !!entryTypes;
  const wantSent = type === 'ALL' || type === 'SENT';
  const wantRedemptions = type === 'ALL' || type === 'REDEEMED';

  const [settings, bills, entries, sent, redemptions] = await Promise.all([
    getProgramSettings(),
    wantBills
      ? prisma.bill.findMany({
          where: { ...ownBills(partnerId), ...(type === 'REDEEMED' && { transactionType: 'WALLET_REDEEM' }), createdAt },
          orderBy,
          take,
          include: billInclude,
        })
      : [],
    wantEntries
      ? prisma.pointsEntry.findMany({
          where: { partnerId, ...(entryTypes && { type: { in: entryTypes } }), createdAt },
          orderBy,
          take,
          include: entryInclude,
        })
      : [],
    wantSent ? prisma.walletTransfer.findMany({ where: { fromPartnerId: partnerId, createdAt }, orderBy, take, include: transferInclude }) : [],
    // Redemptions with a bill are shown as that redeem bill.
    wantRedemptions
      ? prisma.pointsRedemption.findMany({ where: { partnerId, billId: null, createdAt }, orderBy, take, include: redemptionInclude })
      : [],
  ]);

  const ratio = { ...settings.pointsToRupees };
  const rewards = await rewardsByBill(
    partnerId,
    bills.map((b) => b.id)
  );
  const all = [
    ...bills.map((b) => billTransaction(b, rewards.get(b.id) ?? [], partnerId, ratio, now)),
    ...entries.map((e) => entryTransaction(e, partnerId, ratio, now)),
    ...sent.map(sentTransaction),
    ...redemptions.map(redemptionTransaction),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return { items: all.slice(0, limit), hasMore: all.length > limit };
}

/** One transaction for its details page; 404 unless it belongs to this partner. */
export async function getPartnerTransaction(partnerId: string, id: string): Promise<PartnerTransaction> {
  const sep = id.indexOf('_');
  const kind = sep > 0 ? id.slice(0, sep) : '';
  const rowId = id.slice(sep + 1);
  const notFound = () => new HttpError(404, 'Transaction not found', 'TRANSACTION_NOT_FOUND');
  const settings = await getProgramSettings();
  const ratio = { ...settings.pointsToRupees };
  const now = new Date();

  switch (kind) {
    case 'bill': {
      const bill = await prisma.bill.findFirst({ where: { id: rowId, ...ownBills(partnerId) }, include: billInclude });
      if (!bill) throw notFound();
      const rewards = await rewardsByBill(partnerId, [bill.id]);
      return billTransaction(bill, rewards.get(bill.id) ?? [], partnerId, ratio, now);
    }
    case 'entry': {
      const entry = await prisma.pointsEntry.findFirst({ where: { id: rowId, partnerId }, include: entryInclude });
      if (!entry) throw notFound();
      return entryTransaction(entry, partnerId, ratio, now);
    }
    case 'transfer': {
      const transfer = await prisma.walletTransfer.findFirst({ where: { id: rowId, fromPartnerId: partnerId }, include: transferInclude });
      if (!transfer) throw notFound();
      return sentTransaction(transfer);
    }
    case 'redemption': {
      const redemption = await prisma.pointsRedemption.findFirst({ where: { id: rowId, partnerId }, include: redemptionInclude });
      if (!redemption) throw notFound();
      return redemptionTransaction(redemption);
    }
    default:
      throw notFound();
  }
}
