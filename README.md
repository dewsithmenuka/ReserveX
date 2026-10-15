# ReserveX: Resource Reservation Management System

A full-stack web application for booking shared resources (rooms, equipment, and vehicles) with conflict-free scheduling. Built for the PrimeWave Lab Software Engineering Internship assessment.

**Stack:** Next.js (App Router) · TypeScript · PostgreSQL · Prisma · Tailwind CSS · Zod · Vitest

- ER diagram: [docs/er-diagram.md](docs/er-diagram.md)
- Demo video: [ADD_LINK_HERE](ADD_LINK_HERE)

## Features

- Resource management: create, view, edit, search, filter, paginate, and deactivate resources while preserving booking history.
- Reservations: create and list upcoming, cancelled, and all reservations; cancel bookings with live availability feedback.
- Conflict prevention enforced by PostgreSQL using an exclusion constraint, with row locking for concurrent requests.
- Accounts: register, sign in, manage profiles, and change passwords; USER and ADMIN roles.
- Admin area: manage reservations and resources, and view summary statistics.
- Dashboard with live database statistics.
- Payments: per-hour pricing, pay-now flow, simulated payment processing, refunds on cancellation, payment history, and an admin revenue view.
- Responsive interface with light and dark themes and keyboard-accessible controls.

## Getting started

Requirements: Node.js 24 or newer, npm, Git, and Docker Desktop.

```bash
git clone https://github.com/YOUR_USERNAME/reservex.git
cd reservex
npm install
cp .env.example .env
```

Generate a session secret:

```bash
openssl rand -base64 48
```

Set the generated value as `SESSION_SECRET` in `.env`. Configure `DATABASE_URL` to match your Docker PostgreSQL credentials and port.

`APP_ORIGIN` is optional. `INSECURE_COOKIES=true` is only for running `npm start` over plain HTTP in Safari. Do not enable insecure cookies in production.

Initialize the database and start the application:

```bash
docker compose up -d
npx prisma migrate deploy
npx prisma generate
npm run db:seed
npm run dev
```

The application runs at [http://localhost:3000](http://localhost:3000).

### Environment variables

See `.env.example` for the complete list of supported variables.

- `DATABASE_URL`: PostgreSQL connection string.
- `SESSION_SECRET`: Secret used to sign session tokens. Keep it private.
- `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`: Credentials used to create the seeded development administrator.
- `APP_ORIGIN` (optional): Expected origin for requests protected by Origin validation.
- `INSECURE_COOKIES` (optional): Intended only for local development using `npm start` over plain HTTP in Safari. Do not enable it in production.

Never commit `.env` or real credentials to Git.

### Seeded demo data

`npm run db:seed` is repeatable and uses fixed IDs and upserts. It creates four resources, three reservations, and an administrator account using `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from `.env`.

### Demo credentials

- **Admin:** `admin@reservex.test` / the password configured in `.env`.
- **Normal user:** Register an account through the UI.

Do not publish your real administrator password in this README or commit it to Git.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run all tests; requires the test database |
| `npm run test:unit` | Run unit tests only |
| `npm run db:seed` | Seed development data |

## Test database

Integration tests must use a dedicated PostgreSQL test database. The test setup refuses any database whose name does not end in `_test` and checks that the expected Prisma migrations have been applied.

With the project's Docker PostgreSQL container running, create the test database if it does not already exist:

```bash
docker exec reservex-db psql -U reservex -d postgres -c "CREATE DATABASE reservex_test;"
```

Apply all migrations to the test database:

```bash
DATABASE_URL="postgresql://reservex:reservex_dev_password@localhost:5434/reservex_test" npx prisma migrate deploy
```

Run the test suite:

```bash
npm test
```

The default test database URL is configured in `tests/test-db.ts`. You can override it using `TEST_DATABASE_URL`. Update the connection string if your test database credentials or port differ.

**Never point automated tests at a production or development database.** The `_test` suffix is a safety check, not a substitute for verifying the connection string.

## Architecture

ReserveX is structured as a modular monolith with four layers:

1. **UI** (`src/app`, `src/components`): pages and components.
2. **API** (`src/app/api`): Route Handlers that parse requests, validate input with Zod, check permissions, and return JSON.
3. **Services** (`src/modules`): business rules and transactions.
4. **Persistence** (Prisma and PostgreSQL): migrations and database constraints.

### Preventing double bookings

Two layers protect against overlapping reservations:

1. The service locks the resource row using `SELECT ... FOR UPDATE`, checks for conflicts, and inserts the reservation in a transaction.
2. PostgreSQL enforces an exclusion constraint on the resource and `tstzrange(startAt, endAt, '[)')` for confirmed reservations.

Intervals are half-open, so a booking ending at 11:00 does not conflict with one starting at 11:00. Cancelled bookings do not block a slot.

### Payment processing

Payments are simulated using a demo gateway and test cards. A real gateway, such as Stripe Checkout with webhooks, would replace `src/modules/payments/gateway.ts`.

The application calculates reservation charges on the server using resource hourly pricing and reservation duration. The pay-now flow records payment attempts and updates reservation payment status based on the simulated gateway result.

No real money is charged.

## API overview

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/resources` | Public: search, filter, paginate |
| POST | `/api/resources` | Admin |
| GET / PATCH | `/api/resources/[id]` | Public / Admin |
| GET | `/api/reservations` | Signed in: own bookings; admin: all |
| POST | `/api/reservations` | Signed in |
| GET / PATCH | `/api/reservations/[id]` | Owner or admin; PATCH `{"status":"CANCELLED"}` cancels |
| POST | `/api/reservations/[id]/pay` | Owner only; returns 402 when payment is declined |
| GET | `/api/availability` | Public: `resourceId`, `startAt`, `endAt` |
| GET | `/api/dashboard/summary` | Public |
| GET | `/api/health` | Public: database connectivity check |
| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | Public |
| GET | `/api/auth/me` | Signed in |
| PATCH / POST | `/api/profile`, `/api/profile/password` | Signed in |

Errors use a consistent format: `{"error":{"code","message","details?"}}`. Validation failures return 400, unauthenticated requests 401, forbidden requests 403, missing records 404, and conflicts 409. A declined payment returns 402.

## Security notes

- Passwords are hashed with bcrypt. The password policy requires at least 10 characters with an uppercase letter, a lowercase letter, and a number.
- Sessions use signed JWTs in HTTP-only, `SameSite=Lax` cookies and last 24 hours.
- Sessions are revoked server-side on logout and password change.
- Login and registration are rate limited using PostgreSQL-backed rate limiting: five failed logins per email and 20 requests per IP within 15 minutes.
- Cross-site writes are blocked by an Origin check in addition to `SameSite=Lax` cookies.
- Roles are checked on the server for protected operations. Users can only view and cancel their own reservations.
- Inputs are validated with Zod, and database queries use Prisma's parameterized query mechanisms.
- Secrets live in `.env`, which is git-ignored; `.env.example` contains placeholders only.
- Card numbers and CVC are not stored; payment records retain only the card brand and last four digits.
- Prices and reservation totals are calculated on the server; client-submitted totals are not trusted.
- Payment processing uses a row lock and a database unique index to prevent duplicate successful charges.
- Failed payment attempts are capped at five per reservation.
- Error responses do not expose stack traces or internal database details.
- The latest production dependency audit (`npm audit --omit=dev`) reported zero vulnerabilities. The full development dependency audit still reports high-severity findings associated with `braces` in the ESLint tooling dependency tree. These are tracked separately; avoid `npm audit fix --force`, which may introduce incompatible dependency changes. Reassess the findings when compatible patched versions become available.
- Potential future improvements include email verification, password reset, and production monitoring.

## Time zones

The booking form always interprets times as Sri Lanka time (UTC+05:30), whatever the browser's time zone. Storage is UTC.

## Assumptions and limitations

- Reservations cannot start in the past, apart from the configured one-minute grace period.
- Cancelled reservations cannot be edited.
- Resource names are not unique because shared resources can legitimately repeat names across locations.
- Payments are simulated using a demo gateway and test cards only; no real money is charged.
- Production payment processing requires a real payment provider, secure webhook handling, and appropriate operational safeguards.
- The demo does not currently include email verification or password-reset workflows.
