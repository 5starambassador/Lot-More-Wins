import crypto from 'crypto';
import ExcelJS from 'exceljs';
import { Prisma, type Notification, type Payout } from '@prisma/client';
import type {
  FinancePartnerBalance,
  FinancePartnerRef,
  FinanceReport,
  PayoutSheetRowResult,
  PayoutStatus,
  PayoutUploadRecord,
  PayoutUploadResult,
  SuperAdminProfile,
} from '@lotmorewins/types';
import { PAYOUT_SHEET_COLUMNS } from '@lotmorewins/validation';
import prisma from './prisma';
import { HttpError } from './auth';
import { createdAtRange } from './admin-insights';
import { csvDateTime } from './admin-csv';
import { cashBalance, lockWallet, serializePayout } from './cash-wallet';
import { payoutFailedRow, payoutPaidRow } from './partner-notifications';
import { sendPush } from './push';

/**
 * Finance: partner cash reward wallets and payouts. There is no payment gateway: Finance exports
 * the Pending payouts as an Excel sheet, pays them by UPI outside the system, fills in the UPI
 * transaction reference, paid date and status, and uploads the sheet. The upload is validated row
 * by row before anything changes; one bad row rejects the whole file. Applying runs in one
 * transaction, settles each payout at most once (re-uploading the same sheet changes nothing) and
 * logs who uploaded which file.
 */

const Decimal = Prisma.Decimal;
const ZERO = new Decimal(0);

type ReportQuery = {
  page: number;
  limit: number;
  search?: string;
  partnerId?: string;
  status?: PayoutStatus;
  from?: string;
  to?: string;
};

const partnerRefSelect = {
  id: true,
  name: true,
  partnerCode: true,
  mobile: true,
  upiId: true,
  category: true,
} as const;

function partnerWhere(query: ReportQuery): Prisma.PartnerWhereInput {
  const search = query.search?.trim();
  return {
    ...(query.partnerId ? { id: query.partnerId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { partnerCode: { contains: search, mode: 'insensitive' } },
            { mobile: { contains: search } },
            { upiId: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

function payoutWhere(query: ReportQuery): Prisma.PayoutWhereInput {
  const requestedAt = createdAtRange(query);
  const search = query.search?.trim();
  return {
    ...(query.status ? { status: query.status } : {}),
    ...(requestedAt ? { requestedAt } : {}),
    ...(query.partnerId || search
      ? {
          OR: [
            { partner: partnerWhere(query) },
            ...(search && !query.partnerId
              ? [
                  {
                    payoutNumber: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                ]
              : []),
          ],
        }
      : {}),
  };
}

/** Per-partner balances for everyone matching the partner filter who has any cash reward activity. */
async function partnerBalances(query: ReportQuery): Promise<FinancePartnerBalance[]> {
  const inRange = createdAtRange(query);
  const partnerFilter = partnerWhere(query);
  const [all, ranged, pending] = await Promise.all([
    prisma.cashRewardEntry.groupBy({
      by: ['partnerId', 'type'],
      where: { partnerId: { not: null }, partner: partnerFilter },
      _sum: { amount: true },
    }),
    inRange
      ? prisma.cashRewardEntry.groupBy({
          by: ['partnerId', 'type'],
          where: {
            partnerId: { not: null },
            partner: partnerFilter,
            createdAt: inRange,
          },
          _sum: { amount: true },
        })
      : null,
    prisma.payout.groupBy({
      by: ['partnerId'],
      where: { status: 'PENDING', partner: partnerFilter },
      _sum: { amount: true },
    }),
  ]);

  const sums = new Map<
    string,
    {
      credits: Prisma.Decimal;
      paid: Prisma.Decimal;
      earnedIn: Prisma.Decimal;
      paidIn: Prisma.Decimal;
    }
  >();
  const row = (id: string) => {
    if (!sums.has(id)) sums.set(id, { credits: ZERO, paid: ZERO, earnedIn: ZERO, paidIn: ZERO });
    return sums.get(id)!;
  };
  for (const g of all) {
    const r = row(g.partnerId!);
    if (g.type === 'PAYOUT') r.paid = r.paid.plus(g._sum.amount ?? 0);
    else r.credits = r.credits.plus(g._sum.amount ?? 0);
  }
  for (const g of ranged ?? all) {
    const r = row(g.partnerId!);
    if (g.type === 'PAYOUT') r.paidIn = r.paidIn.plus(g._sum.amount ?? 0);
    else r.earnedIn = r.earnedIn.plus(g._sum.amount ?? 0);
  }
  const pendingBy = new Map(pending.map((p) => [p.partnerId, p._sum.amount ?? ZERO]));
  for (const id of pendingBy.keys()) row(id);

  const partners = await prisma.partner.findMany({
    where: { id: { in: [...sums.keys()] } },
    select: partnerRefSelect,
  });
  return partners
    .map((partner) => {
      const s = sums.get(partner.id)!;
      const balance = s.credits.minus(s.paid);
      const pendingAmount = pendingBy.get(partner.id) ?? ZERO;
      return {
        partner,
        earned: s.earnedIn.toNumber(),
        paid: s.paidIn.toNumber(),
        balance: balance.toNumber(),
        pending: pendingAmount.toNumber(),
        available: Decimal.max(ZERO, balance.minus(pendingAmount)).toNumber(),
      };
    })
    .sort((a, b) => b.balance - a.balance || a.partner.name.localeCompare(b.partner.name));
}

export async function getFinanceReport(query: ReportQuery): Promise<FinanceReport> {
  const where = payoutWhere(query);
  const [balances, total, payouts, pendingCount] = await Promise.all([
    partnerBalances(query),
    prisma.payout.count({ where }),
    prisma.payout.findMany({
      where,
      include: { partner: { select: partnerRefSelect } },
      orderBy: { requestedAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.payout.count({ where: { ...where, status: 'PENDING' } }),
  ]);
  const add = (pick: (b: FinancePartnerBalance) => number) => balances.reduce((s, b) => s.plus(pick(b)), ZERO).toNumber();
  const totalPages = Math.max(1, Math.ceil(total / query.limit));
  return {
    totals: {
      balance: add((b) => b.balance),
      pending: add((b) => b.pending),
      available: add((b) => b.available),
      partnersWithBalance: balances.filter((b) => b.balance > 0).length,
      earned: add((b) => b.earned),
      paid: add((b) => b.paid),
      pendingCount,
    },
    balances,
    payouts: payouts.map((p) => ({
      ...serializePayout(p),
      partner: p.partner,
    })),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages,
      hasNextPage: query.page < totalPages,
      hasPrevPage: query.page > 1,
    },
  };
}

// ============================================================================
// Excel export: "Payouts" (the fixed-format sheet Finance fills in and uploads) and "Wallets"
// ============================================================================

const EXPORT_MAX_ROWS = 20_000;
const istDate = (d: Date) => csvDateTime(d).slice(0, 10);

export async function financeWorkbook(query: ReportQuery): Promise<Buffer> {
  const [payouts, balances] = await Promise.all([
    prisma.payout.findMany({
      where: payoutWhere(query),
      include: { partner: { select: partnerRefSelect } },
      orderBy: { requestedAt: 'asc' },
      take: EXPORT_MAX_ROWS,
    }),
    partnerBalances(query),
  ]);

  const book = new ExcelJS.Workbook();
  book.created = new Date();
  const sheet = book.addWorksheet('Payouts');
  sheet.columns = PAYOUT_SHEET_COLUMNS.map((key) => ({
    header: key,
    key,
    width: key === 'partner_name' ? 28 : 20,
  }));
  for (const p of payouts) {
    sheet.addRow({
      payout_id: p.payoutNumber,
      partner_id: p.partner.partnerCode,
      partner_name: p.partner.name,
      mobile: p.partner.mobile,
      upi_id: p.upiId,
      amount: p.amount.toNumber(),
      requested_on: istDate(p.requestedAt),
      source: p.source,
      // Finance fills these in after paying; settled payouts show what was recorded.
      upi_txn_ref: p.upiTxnRef ?? '',
      paid_on: p.paidOn ? p.paidOn.toISOString().slice(0, 10) : '',
      status: p.status,
    });
  }
  sheet.getRow(1).font = { bold: true };
  sheet.getColumn('amount').numFmt = '0.00';
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  const wallets = book.addWorksheet('Wallets');
  wallets.columns = [
    { header: 'partner_id', key: 'code', width: 16 },
    { header: 'partner_name', key: 'name', width: 28 },
    { header: 'mobile', key: 'mobile', width: 14 },
    { header: 'upi_id', key: 'upi', width: 28 },
    { header: 'category', key: 'category', width: 14 },
    { header: 'earned', key: 'earned', width: 12 },
    { header: 'paid', key: 'paid', width: 12 },
    { header: 'balance', key: 'balance', width: 12 },
    { header: 'pending_payout', key: 'pending', width: 14 },
    { header: 'available', key: 'available', width: 12 },
  ];
  for (const b of balances) {
    wallets.addRow({
      code: b.partner.partnerCode,
      name: b.partner.name,
      mobile: b.partner.mobile,
      upi: b.partner.upiId ?? '',
      category: b.partner.category === 'ACHARIYA' ? 'Achariya' : 'Non-Achariya',
      earned: b.earned,
      paid: b.paid,
      balance: b.balance,
      pending: b.pending,
      available: b.available,
    });
  }
  wallets.getRow(1).font = { bold: true };
  return Buffer.from(await book.xlsx.writeBuffer());
}

// ============================================================================
// Payout sheet upload
// ============================================================================

type SheetRow = { row: number; cells: Record<string, string> };

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue);
    if ('richText' in value) return value.richText.map((t) => t.text).join('');
    if ('text' in value) return String(value.text);
    return '';
  }
  return String(value).trim();
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') ((cell += '"'), i++);
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') (row.push(cell), (cell = ''));
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      (row.push(cell), rows.push(row), (row = []), (cell = ''));
    } else cell += c;
  }
  if (cell || row.length) (row.push(cell), rows.push(row));
  return rows;
}

async function readSheet(fileName: string, data: Buffer): Promise<SheetRow[]> {
  let grid: string[][];
  if (/\.csv$/i.test(fileName)) {
    grid = parseCsv(data.toString('utf8').replace(/^﻿/, ''));
  } else {
    const book = new ExcelJS.Workbook();
    try {
      await book.xlsx.load(data as unknown as ArrayBuffer);
    } catch {
      throw new HttpError(422, 'This file could not be read as an Excel (.xlsx) workbook', 'SHEET_UNREADABLE');
    }
    const sheet = book.getWorksheet('Payouts') ?? book.worksheets[0];
    if (!sheet) throw new HttpError(422, 'The workbook has no sheets', 'SHEET_UNREADABLE');
    grid = [];
    sheet.eachRow({ includeEmpty: true }, (r, n) => {
      const values: string[] = [];
      for (let c = 1; c <= Math.max(r.cellCount, PAYOUT_SHEET_COLUMNS.length); c++) values.push(cellText(r.getCell(c).value));
      grid[n - 1] = values;
    });
  }

  const header = (grid[0] ?? []).map((h) => (h ?? '').trim().toLowerCase());
  const missing = PAYOUT_SHEET_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) {
    throw new HttpError(422, `The sheet is missing these columns: ${missing.join(', ')}. Use the exported payout sheet.`, 'SHEET_COLUMNS', {
      missing,
    });
  }
  const rows: SheetRow[] = [];
  for (let i = 1; i < grid.length; i++) {
    const values = grid[i] ?? [];
    if (values.every((v) => !v || !v.trim())) continue;
    const cells: Record<string, string> = {};
    header.forEach((h, j) => (cells[h] = (values[j] ?? '').trim()));
    rows.push({ row: i + 1, cells });
  }
  return rows;
}

/** YYYY-MM-DD, DD-MM-YYYY or DD/MM/YYYY → a real calendar date (UTC midnight), or null. */
function parsePaidOn(value: string): Date | null {
  let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(value);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (dmy) [d, m, y] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
}

const TXN_REF = /^[A-Za-z0-9][A-Za-z0-9/_-]{3,63}$/;
const AMOUNT = /^\d+(\.\d{1,2})?$/;

interface PlannedRow {
  result: PayoutSheetRowResult;
  payout?: Payout;
  paidAmount?: Prisma.Decimal;
  paidOn?: Date;
  upiTxnRef?: string;
}

/** Validates every row against the database; nothing is changed. */
async function planSheet(db: Prisma.TransactionClient | typeof prisma, rows: SheetRow[]): Promise<PlannedRow[]> {
  const numbers = [...new Set(rows.map((r) => r.cells.payout_id?.toUpperCase()).filter(Boolean))];
  const refs = [...new Set(rows.map((r) => r.cells.upi_txn_ref).filter(Boolean))];
  const [payouts, refOwners] = await Promise.all([
    db.payout.findMany({
      where: { payoutNumber: { in: numbers } },
      include: { partner: { select: { name: true } } },
    }),
    db.payout.findMany({
      where: { upiTxnRef: { in: refs } },
      select: { payoutNumber: true, upiTxnRef: true },
    }),
  ]);
  const byNumber = new Map(payouts.map((p) => [p.payoutNumber, p]));
  const refOwner = new Map(refOwners.map((p) => [p.upiTxnRef!, p.payoutNumber]));
  const seenIds = new Map<string, number>();
  const seenRefs = new Map<string, number>();
  const todayIst = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return rows.map(({ row, cells }) => {
    const errors: string[] = [];
    const number = (cells.payout_id ?? '').toUpperCase();
    const status = (cells.status || 'PENDING').toUpperCase();
    const ref = cells.upi_txn_ref ?? '';
    const payout = number ? byNumber.get(number) : undefined;
    const result: PayoutSheetRowResult = {
      row,
      payoutNumber: number || null,
      partnerName: payout?.partner.name ?? (cells.partner_name || null),
      amount: AMOUNT.test(cells.amount ?? '') ? Number(cells.amount) : null,
      action: 'ERROR',
      note: null,
      errors,
    };

    if (!number) errors.push('payout_id is empty');
    else if (!payout) errors.push(`Payout ${number} does not exist`);
    if (number && seenIds.has(number)) errors.push(`Payout ${number} is also on row ${seenIds.get(number)}`);
    else if (number) seenIds.set(number, row);
    if (!['PAID', 'PENDING', 'FAILED'].includes(status)) errors.push('status must be PAID, PENDING or FAILED');
    if (payout && (cells.upi_id ?? '').toLowerCase() !== payout.upiId.toLowerCase()) {
      errors.push(`upi_id does not match the payout (${payout.upiId}); the partner may have changed it — export the sheet again`);
    }

    const planned: PlannedRow = { result, payout };
    if (status === 'PAID') {
      if (!AMOUNT.test(cells.amount ?? '')) errors.push('amount must be a number with at most 2 decimals');
      const paidAmount = AMOUNT.test(cells.amount ?? '') ? new Decimal(cells.amount) : null;
      if (paidAmount && paidAmount.lte(0)) errors.push('amount must be greater than 0');
      if (paidAmount && payout && paidAmount.gt(payout.amount))
        errors.push(`amount is more than the payout amount (₹${payout.amount.toFixed(2)})`);
      if (!ref) errors.push('upi_txn_ref is required for a PAID row');
      else if (!TXN_REF.test(ref)) errors.push('upi_txn_ref must be 4–64 letters, digits, / _ or -');
      else if (seenRefs.has(ref)) errors.push(`upi_txn_ref is also used on row ${seenRefs.get(ref)}`);
      else {
        seenRefs.set(ref, row);
        const owner = refOwner.get(ref);
        if (owner && owner !== number) errors.push(`upi_txn_ref is already recorded for payout ${owner}`);
      }
      const paidOn = cells.paid_on ? parsePaidOn(cells.paid_on) : null;
      if (!cells.paid_on) errors.push('paid_on is required for a PAID row');
      else if (!paidOn) errors.push('paid_on must be a date (YYYY-MM-DD or DD-MM-YYYY)');
      else if (paidOn.toISOString().slice(0, 10) > todayIst) errors.push('paid_on is in the future');
      else if (payout && paidOn.toISOString().slice(0, 10) < istDate(payout.requestedAt))
        errors.push('paid_on is before the payout was requested');

      if (payout && errors.length === 0) {
        if (payout.status === 'PAID') {
          if (payout.upiTxnRef === ref && payout.paidAmount?.equals(paidAmount!)) {
            result.action = 'UNCHANGED';
            result.note = 'Already paid by an earlier upload';
          } else errors.push(`Already paid earlier with UPI ref ${payout.upiTxnRef} for ₹${payout.paidAmount?.toFixed(2)}`);
        } else if (payout.status === 'FAILED')
          errors.push('This payout was marked FAILED earlier and cannot be paid; its amount is back in the wallet');
        else {
          result.action = 'PAID';
          Object.assign(planned, {
            paidAmount: paidAmount!,
            paidOn: paidOn!,
            upiTxnRef: ref,
          });
        }
      }
    } else if (payout && errors.length === 0) {
      if (status === 'FAILED') {
        if (payout.status === 'PENDING') result.action = 'FAILED';
        else if (payout.status === 'FAILED') ((result.action = 'UNCHANGED'), (result.note = 'Already marked failed'));
        else errors.push('This payout is already PAID and cannot be marked failed');
      } else {
        result.action = 'UNCHANGED';
        result.note =
          payout.status === 'PENDING' ? 'Still pending' : `Already ${payout.status.toLowerCase()}; PENDING on the sheet changes nothing`;
      }
    }
    if (errors.length) result.action = 'ERROR';
    return planned;
  });
}

function summarize(fileName: string, planned: PlannedRow[], applied: boolean, uploadId: string | null): PayoutUploadResult {
  const rows = planned.map((p) => p.result);
  const count = (a: string) => rows.filter((r) => r.action === a).length;
  return {
    applied,
    uploadId,
    fileName,
    rowCount: rows.length,
    paidCount: count('PAID'),
    failedCount: count('FAILED'),
    unchangedCount: count('UNCHANGED'),
    errorCount: count('ERROR'),
    paidAmount: planned.reduce((s, p) => (p.result.action === 'PAID' ? s.plus(p.paidAmount!) : s), ZERO).toNumber(),
    rows,
  };
}

/**
 * Validates the sheet and, with apply, applies it: in one transaction every row is validated again
 * under the wallet locks, then each PAID row marks its payout Paid and writes the PAYOUT debit for
 * the amount paid, each FAILED row releases its payout. Any error rejects the whole file.
 */
export async function uploadPayoutSheet(
  input: { fileName: string; base64: string; apply: boolean },
  admin: SuperAdminProfile
): Promise<PayoutUploadResult> {
  const data = Buffer.from(input.base64, 'base64');
  if (data.length === 0) throw new HttpError(422, 'The file is empty', 'SHEET_EMPTY');
  const rows = await readSheet(input.fileName, data);
  if (rows.length === 0) throw new HttpError(422, 'The sheet has no payout rows', 'SHEET_EMPTY');
  if (rows.length > EXPORT_MAX_ROWS) throw new HttpError(422, `A sheet can have at most ${EXPORT_MAX_ROWS} rows`, 'SHEET_TOO_LARGE');

  const preview = await planSheet(prisma, rows);
  const previewResult = summarize(input.fileName, preview, false, null);
  if (!input.apply || previewResult.errorCount > 0) return previewResult;

  const fileHash = crypto.createHash('sha256').update(data).digest('hex');
  const { result, notifications } = await prisma.$transaction(
    async (tx) => {
      // Lock every affected wallet (sorted, so concurrent uploads cannot deadlock), then validate again.
      const partnerIds = [...new Set(preview.filter((p) => p.payout).map((p) => p.payout!.partnerId))].sort();
      for (const id of partnerIds) await lockWallet(tx, id);
      const planned = await planSheet(tx, rows);
      const checked = summarize(input.fileName, planned, false, null);
      if (checked.errorCount > 0) {
        throw new HttpError(
          409,
          'The payouts changed while the sheet was being applied. Nothing was changed; please upload again.',
          'SHEET_STALE',
          checked
        );
      }

      const upload = await tx.payoutUpload.create({
        data: {
          fileName: input.fileName,
          fileHash,
          uploadedById: admin.id,
          uploadedByEmail: admin.email,
          rowCount: checked.rowCount,
          paidCount: checked.paidCount,
          failedCount: checked.failedCount,
          unchangedCount: checked.unchangedCount,
          paidAmount: checked.paidAmount,
        },
      });

      const notes: Notification[] = [];
      const settledAt = new Date();
      for (const p of planned) {
        if (p.result.action === 'PAID') {
          const payout = p.payout!;
          const balance = await cashBalance(tx, payout.partnerId);
          if (balance.balance.lt(p.paidAmount!)) {
            throw new HttpError(
              409,
              `Row ${p.result.row}: the partner's wallet is lower than the amount paid. Nothing was changed.`,
              'WALLET_TOO_LOW'
            );
          }
          // Guarded on PENDING so a payout is settled at most once.
          const updated = await tx.payout.updateMany({
            where: { id: payout.id, status: 'PENDING' },
            data: {
              status: 'PAID',
              paidAmount: p.paidAmount,
              paidOn: p.paidOn,
              upiTxnRef: p.upiTxnRef,
              settledAt,
              uploadId: upload.id,
            },
          });
          if (updated.count !== 1)
            throw new HttpError(
              409,
              `Row ${p.result.row}: payout ${payout.payoutNumber} was settled meanwhile. Nothing was changed.`,
              'SHEET_STALE'
            );
          await tx.cashRewardEntry.create({
            data: {
              type: 'PAYOUT',
              amount: p.paidAmount!,
              partnerId: payout.partnerId,
              payoutId: payout.id,
            },
          });
          notes.push(
            await tx.notification.create({
              data: payoutPaidRow({
                partnerId: payout.partnerId,
                payoutId: payout.id,
                payoutNumber: payout.payoutNumber,
                paidAmount: p.paidAmount!,
                upiId: payout.upiId,
                upiTxnRef: p.upiTxnRef!,
              }),
            })
          );
        } else if (p.result.action === 'FAILED') {
          const payout = p.payout!;
          const updated = await tx.payout.updateMany({
            where: { id: payout.id, status: 'PENDING' },
            data: {
              status: 'FAILED',
              failureNote: 'Marked failed on the payout sheet',
              settledAt,
              uploadId: upload.id,
            },
          });
          if (updated.count !== 1)
            throw new HttpError(
              409,
              `Row ${p.result.row}: payout ${payout.payoutNumber} was settled meanwhile. Nothing was changed.`,
              'SHEET_STALE'
            );
          notes.push(
            await tx.notification.create({
              data: payoutFailedRow({
                partnerId: payout.partnerId,
                payoutId: payout.id,
                payoutNumber: payout.payoutNumber,
                amount: payout.amount,
                upiId: payout.upiId,
              }),
            })
          );
        }
      }
      return {
        result: summarize(input.fileName, planned, true, upload.id),
        notifications: notes,
      };
    },
    { maxWait: 15_000, timeout: 120_000 }
  );

  if (notifications.length) {
    await sendPush(
      notifications.map((n) => ({
        partnerId: n.partnerId,
        title: n.title,
        body: n.body,
        data: { notificationId: n.id, type: n.type },
      }))
    );
  }
  return result;
}

export async function listPayoutUploads(limit = 50): Promise<PayoutUploadRecord[]> {
  const rows = await prisma.payoutUpload.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map((u) => ({
    id: u.id,
    fileName: u.fileName,
    uploadedByEmail: u.uploadedByEmail,
    rowCount: u.rowCount,
    paidCount: u.paidCount,
    failedCount: u.failedCount,
    unchangedCount: u.unchangedCount,
    paidAmount: u.paidAmount.toNumber(),
    createdAt: u.createdAt.toISOString(),
  }));
}

export type { FinancePartnerRef };
