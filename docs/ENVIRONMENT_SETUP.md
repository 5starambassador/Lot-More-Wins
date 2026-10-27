# Lot More Wins — Environment Setup Guide

## Prerequisites
- **Node.js**: v20+ or v24+ LTS (v24.21.0 confirmed)
- **pnpm**: v9+ or v12+ (`pnpm@12.6.0` recommended)
- **Git**: Installed
- **PostgreSQL**: v15+ (optional for Phase 1 verification, mandatory for Phase 2)

## 1. Quick Start
```bash
# 1. Clone & Enter repository
cd lot-more-wins

# 2. Copy environment file
cp .env.example .env.local

# 3. Install all dependencies across monorepo
pnpm install

# 4. Generate Prisma Client
pnpm db:generate

# 5. Verify database connection (optional if PostgreSQL is running)
pnpm db:test

# 6. Start the unified development server
pnpm dev
```

## 2. Dedicated App Commands
```bash
# Start Partner Mobile App (Expo)
pnpm dev:partner

# Start Outlet Admin Mobile App (Expo)
pnpm dev:outlet

# Start Next.js Central Admin + API
pnpm dev:web
```

## Revised flow variables
- `CRON_SECRET` (web, at least 16 characters): protects `/api/cron/weekly-payouts`. Vercel sends it to
  cron jobs automatically when set in the project (the cron is in `apps/web/vercel.json`).
- `MSG91_INVOICE_GST_TEMPLATE_NAME` (optional): approved WhatsApp invoice template with 12 body
  parameters (name, outlet, bill no., bill amount, discount (₹ and %), amount after discount, GST (₹ and %),
  final amount, points, cash reward, points note, download link). Until set, the original 9-parameter
  template is used (its amount is the final payable, but it has no GST line).
