# Lot More Wins — Architecture Documentation

## 1. System Overview

The **Lot More Wins** platform is designed as an enterprise-grade multi-platform loyalty, referral, and discount ecosystem. It unites registered business partners, participating retail outlets, and platform administrators through a single centralized source of truth.

```text
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT APPLICATIONS                      │
├──────────────────────────┬──────────────────────────────────┤
│    Lot More Wins         │       Lot More Wins              │
│    Partner App           │     Outlet Admin App             │
│    (Expo / React Native) │   (Expo / React Native)          │
└────────────┬─────────────┴─────────────────┬────────────────┘
             │                               │
             │ HTTPS / REST                  │ HTTPS / REST
             ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│             CENTRAL PLATFORM SERVER (Next.js)               │
│                                                             │
│   ┌─────────────────────┐       ┌───────────────────────┐   │
│   │   REST API Gateway  │       │   Admin Web Panel     │   │
│   │   (/api/*)          │       │   (App Router / SSR)  │   │
│   └──────────┬──────────┘       └───────────┬───────────┘   │
│              │                              │               │
│              └──────────────┬───────────────┘               │
│                             ▼                               │
│                 CENTRAL DATA ACCESS LAYER                   │
│                 (Prisma ORM + Validation)                   │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               PERSISTENCE & INFRASTRUCTURE                  │
├──────────────────────────────┬──────────────────────────────┤
│  PostgreSQL (Relational DB)  │  Redis (Cache & Invalidation)│
├──────────────────────────────┼──────────────────────────────┤
│  WhatsApp Business Cloud API │  AWS S3 / Storage (Uploads)  │
└──────────────────────────────┴──────────────────────────────┘
```

## 2. Monorepo Organization

```text
lot-more-wins/
│
├── apps/
│   ├── partner-app/            # Expo mobile app for registered partners
│   ├── outlet-admin-app/       # Expo mobile app for outlet store administrators
│   └── web/                    # Next.js App Router (Central Admin + REST API)
│
├── packages/
│   ├── types/                  # Shared TypeScript domain & API contract types
│   ├── validation/             # Shared Zod validation schemas
│   ├── api-client/             # Universal strongly-typed API client
│   └── config/                 # Shared configs (ESLint, TS, Tailwind presets)
│
├── prisma/                     # Central Prisma schema, migrations, connection test
├── docs/                       # Architectural and operational documentation
├── .env.example                # Documented environment template
├── turbo.json                  # Turborepo build & dev task graph
├── pnpm-workspace.yaml         # PNPM workspace definition
└── package.json                # Root package and monorepo scripts
```

## 3. Communication Contract

All clients (Partner App, Outlet Admin App, and external webhooks) communicate with the platform via the Next.js API.
- All requests adhere to JSON payloads validated through `@lotmorewins/validation`.
- Standard responses follow:
  ```json
  {
    "success": true,
    "data": { ... },
    "timestamp": "ISO-8601"
  }
  ```
- Error responses follow:
  ```json
  {
    "success": false,
    "message": "Human-readable description",
    "code": "ERROR_CODE",
    "details": { ... },
    "timestamp": "ISO-8601"
  }
  ```

## 4. Revised flow (outlet offers, GST, cash reward wallet, Finance payouts)

- **Outlet offers** (`lib/outlet-offers.ts`): per-outlet overrides of the first-time (Non-Achariya /
  Achariya), repeat and referral discounts fall back to the programme settings; GST % and the cash
  reward switch are per outlet. Edits from the panel or (when allowed) the Outlet Admin app go through
  `applyOfferChanges`, which writes `outlet_offer_changes` (who, field, old, new, when) and bumps
  `outlets.offers_updated_at`, the version every bill snapshots.
- **Billing** (`lib/billing.ts`) stays one transaction (idempotency key, duplicate window, advisory
  locks, settings-changed check now covering outlet offers). It adds GST on the whole-rupee discounted
  amount and credits the cash reward ledger next to the points ledger.
- **Cash reward wallet** (`lib/cash-wallet.ts`): `cash_reward_entries` is an append-only ledger
  (PURCHASE, REFERRAL credits; PAYOUT debits). `payouts` rows start PENDING (weekly cron or the
  partner's request) and hold their amount; only a PAID row on an uploaded sheet writes the debit, for
  the amount actually paid, so rewards earned after an export are never lost.
- **Finance** (`lib/finance.ts`): Excel export / upload of the payout sheet, validate-all-then-apply in
  one transaction under the per-wallet advisory locks, idempotent per payout, logged in
  `payout_uploads`. No payment gateway: UPI payments happen outside the system.
- **Partner classification**: `partners.category` (Achariya / Non-Achariya, set by the Super Admin)
  selects the first-time discount and referral points %. `partners.upi_id` is required for payouts.
