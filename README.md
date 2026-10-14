# ReserveX: Resource Reservation Management System

A full-stack web app for booking shared resources (rooms, equipment, vehicles) with conflict-free scheduling. Built for the PrimeWave Lab Software Engineering Internship assessment.

**Stack:** Next.js (App Router) · TypeScript · PostgreSQL · Prisma · Tailwind CSS · Zod · Vitest

- ER diagram: [docs/er-diagram.md](docs/er-diagram.md)
- Demo video: ADD_LINK_HERE

## Features

- Resource management: create, view, edit, search, filter, paginate, deactivate (history is kept)
- Reservations: create, list (upcoming / cancelled / all), cancel, with live availability feedback in the form
- Conflict prevention enforced by PostgreSQL itself (exclusion constraint), plus row locking for concurrent requests
- Accounts: register, sign in, profile, password change; roles USER and ADMIN
- Admin area: all reservations (with cancel), all resources (edit, activate, deactivate), summary statistics
- Dashboard with live statistics from the database
- Payments: per-hour pricing, pay-now flow, automatic refund on cancellation, payment history, admin revenue view
- Light and dark theme, responsive layout, keyboard-accessible controls

## Getting started

Requirements: Node.js 24 or newer, npm, Git, Docker Desktop.

```bash
git clone https://github.com/YOUR_USERNAME/reservex.git

cd reservex

npm install

cp .env.example .env     # then set SESSION_SECRET (see below)

docker compose up -d      # PostgreSQL on localhost:5434

npx prisma migrate deploy

npx prisma generate

npm run db:seed

npm run dev               # http://localhost:3000
```

Generate a session secret with `openssl rand -base64 48` and put it in `.env`. Check that the port and password in `DATABASE_URL` match `docker-compose.yml`.

### Seeded demo data

`npm run db:seed` is repeatable (fixed IDs, upsert). It creates four resources, three reservations, and an admin account from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `.env`. These are development credentials only. Register a new account in the UI to try the normal-user role.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm test` | All tests (needs the test database below) |
| `npm run test:unit` | Unit tests only |
| `npm run db:seed` | Seed development data |

### Test database

```bash
docker exec reservex-db psql -U reservex -d postgres -c "CREATE DATABASE reservex_test;"

DATABASE_URL="postgresql://reservex:reservex_dev_password@localhost:5434/reservex_test" npx prisma migrate deploy

npm test
```

The tests refuse to run against any database whose name does not contain `_test`.

## Architecture

A modular monolith in four layers:

1. **UI** (`src/app`, `src/components`): pages and components
2. **API** (`src/app/api`): Route Handlers that parse requests, validate with Zod, check permissions, return JSON
3. **Services** (`src/modules`): business rules and transactions
4. **Persistence** (Prisma + PostgreSQL): migrations and constraints

### Preventing double bookings

Two layers protect against overlaps:

1. The service locks the resource row (`SELECT ... FOR UPDATE`), checks for conflicts, then inserts, all in one transaction, so concurrent requests for the same resource are serialized.
2. PostgreSQL enforces an exclusion constraint on `(resourceId, tstzrange(startAt, endAt, '[)'))` for confirmed reservations, so overlaps are impossible even if application code is bypassed.

Intervals are half-open, so a booking that ends at 11:00 does not conflict with one that starts at 11:00. Cancelled bookings never block a slot.

### Payment processing

Payments are simulated (demo gateway, test cards only). A real gateway such as Stripe Checkout with webhooks would replace `src/modules/payments/gateway.ts`.

The application calculates reservation charges on the server using the resource's hourly price and reservation duration. The pay-now flow records payment attempts and updates reservation payment status based on the simulated gateway result. Successful payments and refunds are recorded in payment history.

## API overview

| Method | Endpoint | Access |
| --- | --- | --- |
| GET | `/api/resources` | Public: search, filter, paginate |
| POST | `/api/resources` | Admin |
| GET / PATCH | `/api/resources/[id]` | Public / Admin |
| GET | `/api/reservations` | Signed in: own bookings (admin: all) |
| POST | `/api/reservations` | Signed in |
| GET / PATCH | `/api/reservations/[id]` | Owner or admin; PATCH `{"status":"CANCELLED"}` cancels |
| POST | `/api/reservations/[id]/pay` | Owner only; returns 402 when payment is declined |
| GET | `/api/availability` | Public: `resourceId`, `startAt`, `endAt` |
| GET | `/api/dashboard/summary` | Public |
| GET | `/api/health` | Public: database connectivity check |
| POST | `/api/auth/register`, `/login`, `/logout` | Public |
| GET | `/api/auth/me` | Signed in |
| PATCH / POST | `/api/profile`, `/api/profile/password` | Signed in |

Errors use one format: `{"error": {"code", "message", "details?"}}`. Validation failures return 400, unauthenticated 401, forbidden 403, missing records 404, and conflicts 409. A declined payment returns 402.

## Security notes

- Passwords hashed with bcrypt; sessions are signed JWTs in HTTP-only, SameSite=Lax cookies.
- Roles are checked on the server for every write; users can only view and cancel their own reservations.
- All input is validated with Zod; queries go through Prisma (parameterized).
- Secrets live in `.env`, which is git-ignored; `.env.example` contains placeholders only.
- Card numbers and CVC are never stored; payment records retain only the card brand and last four digits.
- Prices and reservation totals are calculated on the server; client-submitted totals are not trusted.
- Payment processing is protected against double charges using a row lock and a database unique index for successful charges.
- Failed payment attempts are capped at five per reservation.
- Not implemented (would be next): rate limiting, email verification, password reset.

## Time zones

Timestamps are stored as UTC (`timestamptz`). The UI displays times in Asia/Colombo (UTC+05:30, no daylight saving) and the form reads times in the browser's time zone. "Today" on the dashboard is the Sri Lanka calendar day.

## Assumptions and limitations

- Reservations cannot start in the past (one-minute grace period); cancelled reservations cannot be edited.
- Resource names are not unique, because shared resources can legitimately repeat names across locations.
- Payments are simulated using a demo gateway and test cards only; no real money is charged.