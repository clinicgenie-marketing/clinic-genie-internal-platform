# Performance check with a larger seed

Run on 19 October 2026 on a MacBook (Apple silicon), embedded PostgreSQL 18, production build (`next start`), against an isolated database `clinic_genie_perf` filled by `npm run db:seed-load`. The demonstration database was not touched. The load seed refuses any database whose name does not contain "perf".

## Data volume

| Table | Rows |
| --- | --- |
| clients | 40 |
| staff_users | 30 (289 memberships) |
| tasks | 4,800 (about 3,200 active) |
| approvals | 1,200 |
| seo_pages, seo_changes | 1,600 each |
| issues | 1,600 |
| medical_claims | 600 |
| report_snapshots | 4,800 |
| timeline_events, audit_events | 4,800 each |

This is roughly five to ten times the volume the ten-client agency plan implies for a year of use.

## Server response times (full HTML, median of 3 warm requests)

| Page | Admin (all clients) | Specialist, member of all 40 clients |
| --- | --- | --- |
| Dashboard | 21 ms | 60 ms |
| My tasks (everyone, 500 rows) | 69 ms | 81 ms |
| Clients | 11 ms | 23 ms |
| Client overview | 9 ms | 9 ms |
| Client tasks | 14 ms | 18 ms |
| Approvals | 26 ms | 33 ms |
| SEO | 41 ms | 65 ms |
| Google Ads | 32 ms | 46 ms |
| Issues | 28 ms | 36 ms |
| Medical review | 25 ms | 30 ms |
| Reports (one client) | 16 ms | 16 ms |
| Timeline (200 rows) | 18 ms | 36 ms |
| Admin audit (300 rows) | 19 ms | n/a |

First requests after start were 15 ms to 165 ms (route compilation and cold caches).

## Query plans

With a scoped role, every row-level security policy calls `app_has_membership(client_id)`, which probes the unique partial index on `memberships (user_id, client_id) where active`. For the 500-row task list that is about 16,000 buffer hits and 15 ms of database time; for the 200-row timeline, 24,000 hits and 20 ms. Two alternatives were measured and rejected:

| Variant | Task list | Timeline |
| --- | --- | --- |
| Current: security definer function, per-row index probe | 15 ms | 20 ms |
| Inlinable security invoker function | 26 ms | 36 ms |
| Membership array computed as an init-plan | 46 ms | 68 ms |

The planner did not hoist either alternative, so the simple per-row probe stays. Both experimental migrations were removed before commit.

## Conclusions and limits

- Every list page caps rows (tasks 500, approvals 300, timeline 200, audit 300, snapshots 1,000). Beyond those caps the pages stay fast but hide older rows; add pagination before any client exceeds about 500 active tasks.
- The dashboard loads all active tasks visible to the user and scores them in memory. At 3,200 active tasks this costs about 40 ms. If the agency ever carries more than about 20,000 active tasks, move scoring into SQL or restrict the dashboard query to tasks due within 30 days.
- No N+1 queries were found: list pages run one query per table, and the client overview runs eight small queries.
- Indexes exist on every client, status, owner, due date and occurred-at access path used by the pages.

## Reproduce

```bash
node -e "require('pg').Pool" >/dev/null   # pg is installed with the workspace
DATABASE_ADMIN_URL=postgresql://postgres:postgres@127.0.0.1:54339/clinic_genie_perf npm run db:migrate
DATABASE_ADMIN_URL=postgresql://postgres:postgres@127.0.0.1:54339/clinic_genie_perf npm run db:seed-load
DATABASE_URL=postgresql://cg_app:cg_app_dev@127.0.0.1:54339/clinic_genie_perf DATABASE_ADMIN_URL=postgresql://postgres:postgres@127.0.0.1:54339/clinic_genie_perf AUTH_URL=http://localhost:3401 npx --workspace @clinic-genie/platform next start -p 3401
```

Create the `clinic_genie_perf` database first (for example with `create database clinic_genie_perf` through any Postgres client). Production mode has no development sign-in link, so the timing run created an Auth.js session row directly in the isolated database. Drop the database afterwards.
