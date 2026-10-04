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
  optional `dateOfBirth` (`YYYY-MM-DD`), `password`, `confirmPassword`, `otp`. Returns the profile,
  the two permanent QR codes and a token. Unknown fields are rejected.
- `POST /api/partner/auth/login` — Sign in with mobile or email and password.
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
- `POST /api/outlet/redemptions` — Body `{ qrCode, rupees }`. Spends points (soonest-expiring first)
  at the Super Admin points-to-rupees ratio. A redeem QR works once; a retry from the same outlet
  replays the original result.

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
