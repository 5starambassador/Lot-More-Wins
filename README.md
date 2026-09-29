# Lot More Wins

Enterprise loyalty, referral, and discount ecosystem uniting registered partners, retail outlets, and central administration under a single source of truth.

---

## 1. Applications

The platform consists of three core applications and a shared package ecosystem:

1. **Partner Mobile App (`apps/partner-app`)**
   - Target Users: Registered business partners
   - Platform: React Native / Expo (iOS & Android)
   - Identifier: `com.lotmorewins.partner`
   - Features: Partner dashboard, referral generation, point tracking, wallet payouts, QR code sharing.

2. **Outlet Admin Mobile App (`apps/outlet-admin-app`)**
   - Target Users: Participating store administrators & cashiers
   - Platform: React Native / Expo (iOS & Android)
   - Identifier: `com.lotmorewins.outletadmin`
   - Features: POS bill ingestion, QR scanner, customer discount validation, daily settlement.

3. **Admin Web + Universal API (`apps/web`)**
   - Target Users: Central operations and executive team
   - Platform: Next.js (App Router) + TypeScript + Tailwind CSS
   - Dual Role:
     - **Admin Web Panel**: Comprehensive data dashboards, partner approvals, store controls, audit logs.
     - **REST API Gateway**: Single centralized backend consumed by both mobile applications.

---

## 2. Technology Stack

### Mobile Applications (Partner App & Outlet Admin App)
- **Framework**: React Native with Expo SDK 52 & Expo Router
- **Language**: TypeScript (Strict Mode)
- **Styling**: NativeWind v4 (Tailwind CSS for Mobile)
- **Animations & Gestures**: React Native Reanimated, React Native Gesture Handler
- **State Management**: Zustand & TanStack Query (React Query)
- **Forms & Validation**: React Hook Form with Zod
- **Hardware & Device Integrations**: Expo SecureStore, Expo Camera, Expo Haptics, Expo Image

### Web Application & Backend (`apps/web`)
- **Framework**: Next.js (App Router, Server & Client Components)
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS & shadcn/ui design system tokens
- **ORM & Database**: Prisma ORM with PostgreSQL
- **Architecture**: Centralized REST API endpoints (`/api/*`)

### Monorepo & Shared Packages
- **Monorepo Engine**: Turborepo with pnpm workspaces
- **`@lotmorewins/types`**: Shared domain entities, DTOs, and API contract types
- **`@lotmorewins/validation`**: Shared Zod schemas for input validation
- **`@lotmorewins/api-client`**: Universal, strongly-typed HTTP API client
- **`@lotmorewins/config`**: Reusable TypeScript, ESLint, and Tailwind presets

---

## 3. Architecture Overview

```text
┌────────────────────────┐      ┌────────────────────────┐
│  Partner Mobile App    │      │ Outlet Admin App       │
│  (com.lotmorewins.     │      │ (com.lotmorewins.      │
│   partner)             │      │  outletadmin)          │
└───────────┬────────────┘      └───────────┬────────────┘
            │                               │
            │  @lotmorewins/api-client      │
            └───────────────┬───────────────┘
                            ▼
           ┌─────────────────────────────────┐
           │    Next.js Central Server       │
           │  ┌───────────────────────────┐  │
           │  │ REST API (/api/*)         │  │
           │  ├───────────────────────────┤  │
           │  │ Admin Web Portal (/)      │  │
           │  └─────────────┬─────────────┘  │
           └────────────────┼────────────────┘
                            ▼
           ┌─────────────────────────────────┐
           │     Prisma Data Access Layer    │
           └────────────────┬────────────────┘
                            ▼
           ┌─────────────────────────────────┐
           │   PostgreSQL Database (Source)  │
           └─────────────────────────────────┘
```

---

## 4. Development Commands

### Install Dependencies
```bash
pnpm install
```

### Development
```bash
# Start all applications concurrently
pnpm dev

# Start Partner Mobile App
pnpm dev:partner

# Start Outlet Admin Mobile App
pnpm dev:outlet

# Start Next.js Admin Web & API
pnpm dev:web
```

### Database & Prisma
```bash
# Generate Prisma Client
pnpm db:generate

# Test PostgreSQL connection
pnpm db:test

# Push schema changes to development database
pnpm db:push

# Run database migrations
pnpm db:migrate

# Open Prisma Studio visual GUI
pnpm db:studio
```

### Quality & Verification
```bash
# Typecheck all workspaces
pnpm typecheck

# Lint all workspaces
pnpm lint

# Format code with Prettier
pnpm format
```

---

## 5. Environment Configuration

Copy `.env.example` to `.env.local` and configure your credentials:
```bash
cp .env.example .env.local
```
Key configuration items include:
- `DATABASE_URL`: PostgreSQL connection string
- `NEXT_PUBLIC_API_URL`: Base API URL for web client
- `EXPO_PUBLIC_API_URL`: Base API URL for mobile applications
- `JWT_SECRET` / `JWT_REFRESH_SECRET`: Authentication signing secrets
- `REDIS_URL`: Cache & rate limiting store
- `WHATSAPP_API_URL` & tokens: Customer notifications
- `S3_*`: Object storage for receipts and assets
