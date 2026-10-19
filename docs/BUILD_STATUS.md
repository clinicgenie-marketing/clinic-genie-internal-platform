# Build status

Updated: 19 October 2026, end of the first build session (Day 1 of the 20-day calendar).

## Current stage
First working draft complete for the agency platform: foundation, permissions, all ten modules, seed, tests, backup and restore, browser verification at desktop and mobile. Ahead of the 23 October first-draft target.

## Completed
- Sources read and reconciled: `docs/SOURCE_INVENTORY.md` (includes the sibling `clinic-demo-a` pilot).
- Decisions D1 to D10: `docs/DECISIONS.md`.
- Workspace: `apps/platform` (Next.js 16, Tailwind 4, Auth.js), `packages/db` (PostgreSQL migrations 0001 to 0006 with row-level security, services, seed, backup and restore, Vitest), `packages/contracts`.
- Modules: dashboard queue, my tasks, clients (profile, websites, account references, access), tasks, approvals, SEO, Google Ads, issues and evidence, medical review, reports, timeline, admin (status, users, audit, backups).
- Checks: see `docs/ACCEPTANCE.md`. 21 automated tests pass, type check and build pass, lint has no errors, restore test passed, 44 routes render, unauthenticated access is refused.
- Documentation: `README.md`, `docs/HANDOVER.md`, `docs/QUEUE_SCORING.md`.

## Unresolved decisions (need the user or a named approver)
- Confirm D1 (this repository is the agency platform; the website and lead pilot stay in `clinic-demo-a`) and D6 (role matrix).
- Managed PostgreSQL vendor and region; Google Workspace OAuth client; Vercel plan.
- The absent `05_DASHBOARD_ACTION_QUEUE.md` and `02_INFORMATION_ARCHITECTURE.md` client tabs from the older pack: supply them if the proposed scoring or tabs should change.
- Clinic owner, content approver, security reviewer, release approver remain unnamed.

## Known gaps and limitations
- The DAY-01 decision-record test (uncommitted prior work on branch `cursor/day-01-scope-audit`) asserts an empty repository and now fails by design. Not modified because it is another session's uncommitted work.
- Drawer-style quick view on lists is not built; detail pages are full pages. Lists keep filters in the URL.
- No file was uploaded through the browser yet; the evidence upload path is covered by code review and the authorised download route by an HTTP check.
- Full keyboard-only and screen-reader passes are still to do.
- Working tree has uncommitted changes from another session (DAY-01 files) that this build leaves alone.

## Checks run
`npm run typecheck`, `npm run lint`, `npm run build`, `npm test` (packages/db), `npm run db:backup`, `npm run db:restore-test`, browser walk-through (sign-in, dashboard quick action, all module pages, mobile menu), HTTP checks without a session.

## Exact next step
On a resumed session: `npm run db:start`, `npm run dev`, sign in as `admin@example.invalid`. Then either (a) start Milestone 2 refinement from `docs/HANDOVER.md` section 5, or (b) if the user wants a different build order, re-read `docs/DECISIONS.md` D1 and adjust.
