# Lot More Wins — API Specification (Phase 1 Foundation)

## Base URL
- Local Development: `http://localhost:3000/api`
- Staging / Production: `https://superadmin.lotmorewins.com/api`

## Core Endpoints

### 1. Health Probe
- **Endpoint**: `GET /api/health`
- **Description**: Probes Next.js runtime status and optional PostgreSQL connectivity.
- **Response (200 OK)**:
  ```json
  {
    "status": "ok",
    "service": "lot-more-wins-api",
    "timestamp": "2026-09-29T08:45:00.000Z",
    "database": "connected"
  }
  ```

### 2. Architecture Route Stubs (Phase 2 Implementations)
The following REST API endpoints are established with architectural route handlers:
- `POST /api/auth/otp/request` — Request mobile OTP
- `POST /api/auth/otp/verify` — Verify mobile OTP & issue JWT session
- `GET /api/partners` — Query partners list (Admin)
- `POST /api/partners` — Register new partner
- `GET /api/outlets` — Query outlets and active counters
- `GET /api/referrals` — Query referral trees and attribution
- `POST /api/bills` — Ingest store bill and compute discount/points
- `GET /api/wallet` — Retrieve wallet balance and ledger history
- `GET /api/points` — Retrieve loyalty points ledger
- `GET /api/settings` — Retrieve platform rules and conversion rates

### 3. Partner App (single partner role)
Every partner registers the same way and gets the same discounts and points from the Super Admin
settings; there is no partner classification. All routes below except onboarding and login need
`Authorization: Bearer <partner token>`.

- `POST /api/partner/onboarding` — Register. Body: `name`, `mobile`, `email`, `city`, `state`, `pincode`,
  optional `dateOfBirth` (`YYYY-MM-DD`), optional `referredBy` and `upiId`, `otp`. No password
  (older app versions may still send `password` / `confirmPassword`; they are ignored). Returns the
  profile, the two permanent QR codes and a token. Unknown fields are rejected.
- `POST /api/partner/auth/otp` — Sign-in step 1. Body `{ identifier }` (registered mobile or email).
  Sends a 6-digit code on the Super Admin's messaging channel (email → the partner's registered
  email, WhatsApp → their registered mobile); the partner never chooses. Returns `mode`, a masked
  `destination` and `expiresAt`. `404 PARTNER_NOT_FOUND`, `403 PARTNER_INACTIVE`, `429` after 5 codes
  in 10 minutes.
- `POST /api/partner/auth/login` — Sign-in step 2. Body `{ identifier, otp }`. The current app has
  no password sign-in. Partner App v1.0.0 (still installed as APKs) sends `{ identifier, password }`
  instead; that is checked against the password set at registration (`401 INVALID_CREDENTIALS`).
  Partners who registered without a password can only use a code. `POST /api/partner/onboarding`
  saves a `password` when an old app sends one.

Partner and Outlet Admin tokens never expire: a session lasts until the user signs out on that
device (Super Admin sessions still expire after 12 hours).
- `GET /api/partner/me` — Profile and permanent QR codes.
- `PATCH /api/partner/me` — Edit `name`, `mobile`, `email`, `city`, `state`, `pincode`, `dateOfBirth`,
  `photoUrl`. A new mobile or email must be OTP-verified first (`POST` then `PUT /api/auth/otp`),
  otherwise `403 OTP_REQUIRED`.
- `GET /api/partner/home` — Successful referrals towards the goal, current offers (first-purchase,
  birthday bonus, repeat discount), unread notification count and the app download link.
- `GET /api/partner/notifications?page&limit` — Activity feed, newest first.
- `POST /api/partner/notifications/read` — Mark all notifications read.
- `POST /api/partner/push-token` / `DELETE /api/partner/push-token?token=` — Register / remove this
  device's Expo push token.
- `GET /api/partner/wallet` — Available points (unexpired, not redeemed), rupee value, ledger entries
  with expiry dates, and redemptions.
- `POST /api/partner/wallet/redeem-qr` — New short-lived, single-use redeem QR (`LMW-RDM.<token>`).
- `GET /api/outlets` — Active outlets with description, address, map link, logo and gallery.

### 4. Outlet Admin: wallet redemption
`Authorization: Bearer <outlet admin token>`.

- `POST /api/outlet/redemptions/scan` — Body `{ qrCode }`. Validates a redeem QR and returns the
  partner and their live balance and rupee worth.
- `POST /api/outlet/redemptions` — Outlet Admin app v1.0.0 only. Body `{ qrCode, rupees, billAmount }`.
  Becomes a `WALLET_REDEEM` bill paying exactly `rupees` from the wallet; more than the bill can take
  (half the bill, the QR's worth, the balance) is refused with `422 REDEEM_OVER_LIMIT` and the most
  allowed. Returns the old `RedemptionReceipt` (`payableAmount` = the bill's `finalAmount`). A redeem
  QR works once; a retry replays the receipt.

### 5. Programme settings (`GET` / `PUT /api/admin/settings`)
Single percentages: `firstTimeDiscount`, `repeatDiscount`, `birthdayBonusDiscount` (added to the
partner's own bill on their birthday), `referralDiscount`, `referralPointsPercentage`,
`purchasePointsPercentage`; plus `firstTimeValidityDays`, `purchasePointsValidityDays`,
`referralPointsValidityDays`, `pointsToRupees`, `pointsBasis`, `messagingMode`, `appDownloadUrl`.

Referral reward: `referralRewardGoal` (successful referrals needed, whole number ≥ 1) and
`referralRewardDiscount` (special discount % on the partner's next own purchase with their Personal
Discount QR; it replaces the usual discount when higher, and using it takes the progress back by
one goal). Defaults: first-time 20%, repeat 10%, referral customer 10%, goal 10, reward 20%.

### 6. Super Admin lists: filters and CSV export
Session cookie (or `Authorization: Bearer <super admin token>`). Every list below accepts an
inclusive IST date range `from` / `to` (`YYYY-MM-DD`, either end optional) and `format=csv`, which
returns the **whole filtered result** as `text/csv` (attachment, UTF-8 with BOM, up to 20,000 rows;
text cells starting with `=`, `+`, `-` or `@` are prefixed with `'`).

- `GET /api/admin/partners?page&limit&search&status&referrals&sort&from&to` — `referrals=with|without`
  keeps partners with / without a successful referral; dates filter the registration date. Items
  include `referralShareCount`.
- `GET /api/admin/partners/:id` — profile, wallet, QR codes, all-time totals and `referralTracking`
  (`total`, `uniqueCustomers`, `progress` / `goal`, `rewardAvailable`, `rewardDiscount`,
  `rewardsUsed`, `shares`).
- `GET /api/admin/partners/:id/activity?page&limit&from&to&outletId&kind` — the partner's activity
  log, newest first: `PURCHASE` (own bills), `REFERRAL` (bills closed with their referral QR, with
  the customer's name and mobile), `REDEMPTION`, `SHARE` (taps of "Share QR"). Returns `rows`, `meta`
  and a `summary` for the date / outlet filter.
- `GET /api/admin/transactions?page&limit&search&outletId&partnerId&type&notification&range&from&to`
- `GET /api/admin/outlets?search&status&from&to` — dates filter the date the outlet was added.
- `GET /api/admin/outlets/:id/redemptions?page&limit&from&to` — wallet redemptions at the outlet,
  with `summary` (`count`, `points`, `rupeeValue`).
- `GET /api/admin/dashboard?from&to` — period defaults to the last 30 days. Adds `range`, `period` /
  `previousPeriod` totals, `trend` (per day, or per month beyond 92 days: bills, sales, discounts,
  referral bills, QR shares, new partners, points credited / redeemed), `periodByType`,
  `topOutlets`, `topReferrers`, `referrals`, `pointsFlow`; `notifications` is scoped to the period.

Outlets hold at most 12 gallery images (`MAX_OUTLET_IMAGES`).

## Revised flow: outlet offers, GST, cash reward, payouts

### Bill calculation (server only, `apps/web/lib/billing.ts`)
- Discount per type comes from the **outlet's override**, else the programme setting: first-time
  (Non-Achariya / Achariya by the partner's `category`), repeat, referral. Birthday bonus and referral
  reward stay programme-wide.
- `taxableAmount` = bill − discount, **rounded half-up to whole rupees** (as before);
  `gstAmount` = taxable × outlet `gstPercentage`, to the paisa; `finalAmount` (payable) = taxable + GST.
  Example: ₹100, 10%, GST 5% → ₹90 + ₹4.50 = ₹94.50. GST 0 bills exactly as before.
- Points and cash reward use the pre-GST amount (`pointsBasis`: bill or taxable amount).
- Cash reward (₹) only at outlets with `givesCashReward`: purchase % to the purchaser (held for an
  unregistered referred customer, claimed on registration), referral % to the referring partner.
- Referral points % follows the referring partner's category.
- `settingsVersion` returned by scan/preview is the **later of** the programme settings and the outlet's
  `offersUpdatedAt`; `POST /api/outlet/bills` refuses a stale one with `409 SETTINGS_CHANGED`.
- Each bill snapshots `discountPercentage`, `taxableAmount`, `gstPercentage`, `gstAmount`,
  `finalAmount`, cash reward % and amounts, `partnerCategory`, `settingsVersion`, `outletSettingsVersion`.

### Partner App
- `POST /api/partner/onboarding` — adds optional `upiId` (`name@handle`; required by the current app,
  optional for older versions).
- `PATCH /api/partner/me` — `upiId` (change only; Pending payouts move to the new UPI ID).
- `GET /api/partner/home` — adds `outlets` (each with `offer.label`, `maxDiscount`, `isFlat`,
  `givesCashReward`), `maxOutletDiscount`, `cashBalance`, `upiMissing`, `redeemEnabled`.
- `GET /api/partner/offers` (public) — adds `maxOutletDiscount`. `GET /api/outlets` — adds `offer`.
- `GET /api/partner/wallet` — adds `cash` (CashWallet) and `redeemEnabled`.
- `GET /api/partner/payouts` — cash wallet and payout history.
- `POST /api/partner/payouts` `{}` — request a payout of the whole available balance → `PENDING`.
  Errors: `422 UPI_REQUIRED`, `409 PAYOUT_PENDING`, `422 NO_CASH_BALANCE`, `403 PARTNER_INACTIVE`.
- The redeem QR (`/partner/wallet/redeem-qr`, `/outlet/redemptions*`) answers `422 REDEEM_DISABLED`
  unless the `redeemQrEnabled` setting is on (off by default).

### Outlet Admin
- `GET /api/outlet/settings` — offers, effective and programme discounts, label, change log.
- `PATCH /api/outlet/settings` — `firstTimeDiscount`, `achariyaFirstTimeDiscount`, `repeatDiscount`,
  `referralDiscount` (number or `null` = programme value), `gstPercentage`. Only when the outlet has
  `canEditOffers`, else `403 OFFERS_EDIT_FORBIDDEN`. Every changed field is audit-logged.

### Super Admin
- `POST/PATCH /api/admin/outlets[/:id]` — the offer fields above plus `givesCashReward`, `canEditOffers`
  (audit-logged). `GET /api/admin/outlets/:id/offer-changes` — the audit log.
- `PATCH /api/admin/partners/:id` — `{ status?, category? }` (`ACHARIYA` | `NON_ACHARIYA`).
- Settings add `achariyaFirstTimeDiscount`, `achariyaReferralPointsPercentage`,
  `cashRewardPurchasePercentage`, `cashRewardReferralPercentage`, `weeklyPayoutEnabled`,
  `payoutMinimumAmount`, `payoutWeekday` (0 = Sunday, IST), `redeemQrEnabled` (all optional on PUT).
- Transactions list and CSV add after-discount, GST %, GST, payable, category, cash reward columns.

### Finance (panel page `finance`, an ADMIN account with `finance` in `pages`)
- `GET /api/admin/finance/payouts?search&partnerId&status&from&to&page&limit` — totals, per-partner
  balances, payouts. `&format=xlsx` downloads the workbook: sheet **Payouts** with columns
  `payout_id, partner_id, partner_name, mobile, upi_id, amount, requested_on, source, upi_txn_ref,
  paid_on, status` and sheet **Wallets**.
- `POST /api/admin/finance/payouts/upload` `{ fileName, base64, apply }` — the filled-in Payouts sheet
  (.xlsx or .csv). Every row is validated first (payout exists, UPI ID unchanged, amount ≤ payout,
  PAID needs `upi_txn_ref` and `paid_on`, no duplicate payouts or references); any error rejects the
  whole file with row-level errors. With `apply: true` it is validated again under the wallet locks
  and applied in one transaction: PAID → payout Paid + a PAYOUT debit of the amount paid; FAILED →
  amount released; already-settled rows are UNCHANGED (re-uploading is a no-op). Each applied file is
  logged (uploader, file name, SHA-256). `GET` on the same path lists the uploads.
- `GET /api/cron/weekly-payouts` — `Authorization: Bearer $CRON_SECRET` (Vercel cron, daily 03:30
  UTC). On the configured IST weekday creates one Pending payout per active partner whose available
  balance ≥ `payoutMinimumAmount` and who has a UPI ID; `?force=1` runs on any day. Idempotent per week.

## One wallet, redeem bills and partner transfers (supersedes cash wallet and payouts above)

- **One wallet.** Purchase / referral points, cashback (the cash reward, credited as points at the
  ratio, never expires) and points received from other partners all live in the points ledger.
  Migration 17 cancelled every Pending payout and moved each cash reward balance into the wallet
  (`CASH_WALLET_MERGE` entries). UPI payouts ended: `POST /api/partner/payouts` → `410
  PAYOUTS_ENDED`, `GET /api/partner/payouts` and `PartnerWallet.cash` return an empty cash wallet,
  the weekly-payout cron is a no-op, and `POST /api/admin/finance/payouts/upload` → `410`.
- **Per-outlet rates.** Outlets may also override `purchasePointsPercentage`,
  `referralPointsPercentage`, `achariyaReferralPointsPercentage`, `cashRewardPurchasePercentage`
  and `cashRewardReferralPercentage` (null = programme setting), from the Super Admin outlet form
  or (with `canEditOffers`) the Outlet Admin app. `AdminOutlet` and `OutletSettingsView` add
  `effectiveRewards` (and `programmeRewards`).
- **First-time is per outlet**: the first DIRECT_PARTNER bill at each outlet (within the
  first-time validity) gets that outlet's first-time discount; a referred customer's first bill at
  each outlet likewise.
- **50% cap.** No discount setting may exceed 50%, and a bill's total discount (birthday bonus and
  referral reward included) never exceeds 50% of the bill, so no bill is ₹0.
- **One QR per bill**: Personal Discount QR, Referral QR, or redeem QR. A redeem QR
  (`POST /api/partner/wallet/redeem-qr`) is worth the whole wallet (`maxPoints` / `maxRupees`,
  signed into the token; nothing is held). It goes through `POST /api/outlet/bills/preview` and
  `POST /api/outlet/bills` like any QR and creates a `WALLET_REDEEM` bill: no discount, no rewards,
  GST on the bill, and the wallet pays `walletRedeemAmount` = min(QR worth, live balance, 50% of the
  bill); `finalAmount` is what the customer pays. The rest of the QR's worth stays in the wallet.
  `POST /api/outlet/redemptions/scan` returns the QR's worth; `POST /api/outlet/redemptions` serves
  Outlet Admin app v1.0.0 (see §4).
- **Transfers** (`Authorization: Bearer <partner token>`):
  - `GET /api/partner/wallet/transfer/recipient?mobile=` — the active partner with that mobile
    (`404 RECIPIENT_NOT_FOUND`, `422 SELF_TRANSFER`).
  - `POST /api/partner/wallet/transfer/otp` `{ mobile, points }` — checks recipient, balance and the
    limit (one transfer sends at most half the wallet: `transferMaxPoints` in the wallet, `422
    TRANSFER_LIMIT`), then sends the sender a code on the Super Admin messaging channel.
  - `POST /api/partner/wallet/transfer` `{ mobile, points, otp, idempotencyKey }` — spends the
    sender's points soonest-expiring first; the recipient gets one `TRANSFER_IN` entry with the
    soonest expiry among the points sent. Idempotent per key. Both sides are notified.
