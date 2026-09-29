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
