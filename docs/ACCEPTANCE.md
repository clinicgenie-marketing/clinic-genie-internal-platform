# Acceptance checks and results

Run on 19 October 2026 against the local development database (embedded PostgreSQL on port 54339, seeded) and the dev server on port 3400, branch `feature/platform-foundation`. "Automated" means `npm test` (packages/db, Vitest). "Browser" means exercised in the built-in browser with a signed-in session. "HTTP" means direct requests without a session.

| ID | Check | Method | Result |
| --- | --- | --- | --- |
| A-01 | Client profile: owner, channels, notes, persistent id, archive and restore | Browser (/clients, /clients/[id]/profile) | Passed |
| A-02 | Archiving keeps every linked record | Code review of `archiveClient` (soft status change only) and browser | Passed |
| A-03 | Websites and account references; credential-looking values refused | Browser; `assertNoSecret` rejects "password:", "api key=", "token:" patterns | Passed |
| A-04 | Specialist sees only member clients; direct queries for other clients return nothing | Automated (permissions.test.ts) | Passed |
| A-05 | Guessed ids outside membership behave as not found; anonymous context sees nothing; deactivated user loses access at once | Automated | Passed |
| A-06 | Read-only cannot mutate; reviewer cannot edit tasks; cross-client insert refused | Automated | Passed |
| A-07 | Dashboard sections (urgent, due today, waiting, upcoming) exclude completed and cancelled | Automated (pure.test.ts) and browser | Passed |
| A-08 | Deterministic score with stable tie-break; Asia/Singapore day boundaries | Automated | Passed |
| A-09 | One accountable owner; High/Critical need a due date; Waiting needs waiting-on and follow-up; history preserved | Automated and database constraints | Passed |
| A-10 | Related-record selector is client-scoped; cross-client link refused | Automated | Passed |
| A-11 | Approvals: draft, submit, decide, changes requested, withdraw; requester cannot decide | Automated and browser | Passed |
| A-12 | Decisions append-only; revision creates a linked decision and marks the old one superseded; update and delete refused by the database | Automated | Passed |
| A-13 | SEO mapping with flags, review dates, before/after change records and verification notes | Browser (/seo, /seo/pages/[id]) | Passed |
| A-14 | Google Ads audits, findings, changes with before/after, reason, responsible staff, approval reference, verification | Browser (/google-ads and detail pages) | Passed |
| A-15 | Issue workflow with verifier, date and result; failed verification reopens | Automated and browser | Passed |
| A-16 | Evidence: private upload served only to authorised staff; unauthenticated request gets 401 | HTTP (`/api/evidence/[id]` without session returned 401); upload form present | Passed (upload itself exercised in code, not yet with a real file in the browser) |
| A-17 | Medical review: no approval without a source; decided reviews immutable; wording change preserves and supersedes reviews | Automated and browser | Passed |
| A-18 | Report snapshots immutable; correction supersedes; null stays unavailable | Automated and browser | Passed |
| A-19 | Comparison maths: zero baseline gives no percentage, unavailable never becomes zero, unequal periods flagged | Automated and browser (/reports) | Passed |
| A-20 | Timeline events generated in the same transaction and idempotent on retry | Automated | Passed |
| A-21 | Audit log append-only; sensitive actions recorded without personal data | Automated (update and delete refused even for the owner); audit metadata reviewed | Passed |
| A-22 | Design: Plus Jakarta Sans, aqua navigation, status badges with text, keyboard focus visible, responsive at 375 px with a working menu | Browser screenshots at desktop and mobile | Passed (full keyboard and screen-reader pass still to do) |
| A-23 | Seed: three fictional clients with overdue, waiting, decisions, SEO and Ads changes, issues, sources and comparable periods; refuses production targets; idempotent (no-op on rerun) | `npm run db:seed` twice | Passed |
| A-24 | Backup and restore into an isolated database with counts, relationship and policy checks; result recorded | `npm run db:backup`, `npm run db:restore-test` (restore test PASSED; isolation check user A 11, user B 3 of 14 tasks) | Passed |
| A-25 | Unauthenticated access to staff pages redirects to sign-in | HTTP (/, /clients, /admin, /tasks/new all 307 to /sign-in) | Passed |
| A-26 | Every route renders without server error for the admin session | Fetch of 44 routes with the session cookie: all 200; unknown routes 404 | Passed |
| A-27 | Type check, lint and production build | `npm run typecheck`, `npm run lint`, `npm run build` | Passed (two `<img>` lint warnings for the SVG brandmark remain; no errors) |

## Blocked

| Check | Why |
| --- | --- |
| Managed sign-in (Google Workspace) end to end | No OAuth client is configured. The provider is wired and switches on with two environment variables. |
| Staging deployment and staging checks | No Vercel project or managed PostgreSQL has been approved or created. |
| Independent security review | Reviewer not named or booked. |
| DAY-01 decision-record test (`npm run test:decisions`) | That test asserts the repository has no `package.json`, `apps/` or `.github`. It was a snapshot of the empty repository and now fails by design. The CG-01 test still passes. |

## Not claimed

No live Google Ads, GA4 or Search Console connection exists. Nothing in the platform crawls or changes a client site or account. "Approved" in medical review is a workflow outcome, not regulatory certification. A green backup or recovery status appears only after a recorded run.
