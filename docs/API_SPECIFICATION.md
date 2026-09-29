# Lot More Wins — API Specification (Phase 1 Foundation)

## Base URL
- Local Development: `http://localhost:3000/api`
- Staging / Production: `https://api.lotmorewins.com/api`

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
