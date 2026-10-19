# Clinic Genie platform

Internal operations platform for Clinic Genie staff: client profiles, a prioritised action queue, tasks, approvals, SEO content mapping, Google Ads audit and change log, issue register with evidence, medical review and source records, performance reporting and the change and outcome timeline.

This repository also holds the Phase 1 specification pack (`00_README.md` to `20_DELIVERY_TIMELINE.md`) and its decision records. The Phase 1 clinic website and lead pilot live in the separate `clinic-demo-a` repository and are not duplicated here (see `docs/DECISIONS.md` D1).

**Everything in the seed is fictional.** Three demonstration clinics, six demonstration staff accounts and synthetic figures. No real client, account ID, contact or result.

## Run it locally

Requirements: Node 20.9 or later (24 recommended). No Docker or Postgres install is needed; a development PostgreSQL runs from embedded binaries.

```bash
npm install
cp .env.example .env            # then set AUTH_SECRET to a long random string
npm run db:start                 # PostgreSQL on 127.0.0.1:54339 (keep this running)
npm run db:migrate               # applies packages/db/migrations in order
npm run db:seed                  # three fictional clinics with linked records (idempotent)
npm run dev                      # http://localhost:3400
```

Sign in at `http://localhost:3400/sign-in` with one of the seeded addresses (for example `admin@example.invalid`). In development no email is sent: the sign-in link is recorded in the database and listed at `http://localhost:3400/dev/magic-links`. Google Workspace sign-in switches on when `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are set.

| Seeded account | Role | Sees |
| --- | --- | --- |
| admin@example.invalid | admin | Everything, plus Admin |
| manager@example.invalid | manager | Every client; decides approvals |
| specialist-a@example.invalid | specialist | Harbourview Dental, Meridian Skin |
| specialist-b@example.invalid | specialist | Northgate Physio |
| reviewer@example.invalid | reviewer | Harbourview Dental, Meridian Skin (review only) |
| readonly@example.invalid | read_only | Harbourview Dental (view only) |

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Platform app in development on port 3400 |
| `npm run build` | Production build of every workspace |
| `npm run typecheck`, `npm run lint` | TypeScript and ESLint across workspaces |
| `npm test` | Vitest suites (permissions, workflows, pure logic). Needs the database running and seeded |
| `npm run db:backup` | Logical backup to `backups/backup-<timestamp>.json`, recorded in `backup_runs` |
| `npm run db:restore-test` | Restores the latest backup into an isolated database, verifies counts, relationships and policies, records the result |
| `npm run db:reset` | Drops and recreates the schema (development only, refuses production names) |
| `npm run test:decisions` | The earlier CG-01 and DAY-01 decision-record checks (see BUILD_STATUS for why DAY-01 now fails) |

## Repository layout

| Path | Purpose |
| --- | --- |
| `apps/platform` | Next.js 16 app: shell, sign-in, dashboard, clients, tasks, approvals, SEO, Google Ads, issues, medical review, reports, timeline, admin |
| `packages/db` | PostgreSQL migrations with row-level security, domain services, seed, backup and restore, tests |
| `packages/contracts` | Shared vocabularies (roles, statuses, metrics, event types) |
| `docs/` | Source inventory and requirements matrix, decisions log, build status, queue scoring, acceptance results, handover |
| `00_*.md` to `20_*.md`, `decisions/`, `tests/` | The Phase 1 specification pack and its practice decision records |

## Environment variables

Names only; see `.env.example`. Never commit `.env`.

`DATABASE_ADMIN_URL`, `DATABASE_URL`, `APP_DB_PASSWORD`, `EMBEDDED_PG_PORT`, `EMBEDDED_PG_DIR`, `SEED_ALLOWED_DB_PATTERN`, `AUTH_SECRET`, `AUTH_URL`, `AUTH_DEV_MAGIC_LINKS`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `APP_ENVIRONMENT_LABEL`, `UPLOADS_DIR`.

## Hosting note

Running this app on Vercel or elsewhere preserves the database records, not this conversation. Backups are the `db:backup` exports plus whatever the managed database provider keeps. Neither replaces the other, and a successful run is shown in Admin only after it has actually happened.
