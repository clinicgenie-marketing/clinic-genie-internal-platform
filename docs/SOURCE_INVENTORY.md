# Source inventory, conflicts and requirements matrix

Prepared: 19 October 2026. Working product name: Clinic Genie. This file records what was read, what it decides, where documents disagree, and how each requirement maps to the build.

## 1. Sources read

| # | Source | Location | Date | Read | Role |
| --- | --- | --- | --- | --- | --- |
| S1 | Clinic_Genie_Claude_Code_Prompt.md | ~/Downloads | 19 Oct 2026 14:11 | Yes | The build prompt. Written against an older spec zip (`00_README` to `20_TWO_WEEK_TIMELINE`). Its author states the later Phase 1 pack was not available for verification. |
| S2 | Clinic_Genie_Phase_1_Developer_Implementation_Pack_V2.pdf (23 pages) | ~/Downloads | 16 Oct 2026 | Yes, text extracted | Authoritative Phase 1 plan. Website backend first; the ten agency modules become the Phase 2 backlog. |
| S3 | Specification pack, 21 files `00_README.md` to `20_DELIVERY_TIMELINE.md` | this repository | 16 Oct 2026 (V2.0) | Yes, all 21 | Markdown derivative of S2. It states the dashboard-first pack is superseded. |
| S4 | Clinic_Demo_A_Build_Plan.md | ~/Downloads | 19 Oct 2026 | Yes | Clinic website component (Demo Clinic A, private cardiology). Does not replace S2. |
| S5 | Clinic_Genie_20_Day_Calendar.ics, _Kanban.xlsx, _Interactive_Board.html | ~/Downloads | 19 Oct 2026 12:52 | .ics read | Updated 20-day calendar: 19 Oct to 17 Nov, 6 Nov and 9 Nov unavailable, weekends excluded. All 20 days are Phase 1 website and backend work. |
| S6 | Clinic_Genie_Vibe_Coding_Calendar_Revised.ics, Clinic_Genie_Development_Schedule.ics | ~/Downloads | 19 Oct 2026 | Summaries read | Older 39-ticket calendars to 14 Dec. Superseded by S5. |
| S7 | Clinic Genie _ Platform Overview (Reworked).pdf (13 pages) | ~/Downloads | 16 Oct 2026 | Yes | The original ten-feature agency proposal. Kept as Phase 2 backlog by S2. |
| S8 | Clinic Genie _ Dashboard Wireframe.pdf (3 pages) | ~/Downloads | 16 Oct 2026 | Yes | Visual direction only: airy shell, rounded modules, aqua status tiles. |
| S9 | decisions/CG-01-pilot-scope.md, decisions/DAY-01-scope-audit.md and their tests | this repository | 19 Oct 2026 | Yes | Prior practice records (uncommitted on branch `cursor/day-01-scope-audit`). Pilot = Demo Clinic A, new build, enquiry mode, no providers confirmed. Not signed. |
| S10 | ~/vsc/client-intelligence-platfrom (React + Vite demo, Sept 2026) | sibling folder | 16 Sep 2026 | Inspected | Earlier demo-only dashboard with no backend. Preserved untouched. Not a suitable base for durable storage and server-enforced permissions. |
| S11 | Brand assets: clincigenie_brandmark.svg, brandmark PNGs | ~/Downloads | 19 Oct 2026 | Listed | Vector brandmark available for the admin shell. |
| S12 | ~/vsc/clinic-demo-a (GitHub clinicgenie-marketing/clinic-demo-a) | sibling folder | 19 Oct 2026, two commits | README, architecture, conflicts and routes read | The Phase 1 pilot: Demo Clinic A website (12 pages), versioned form endpoint, enquiry storage with idempotency, notification outbox, minimal Control Centre (enquiries, notifications, websites, export), restore test. Runs on ports 3000, 3100 and 54329. Not duplicated here. |

Not found: the older `clinic_genie_platform_md` zip contents named in S1 (`05_DASHBOARD_ACTION_QUEUE.md`, `20_TWO_WEEK_TIMELINE.md`, the IA client tabs), an approved Wix category list, a hybrid website amendment, a Pinterest board, `Clinic_Demo_A_Claude_Code_Prompt.md`. Nothing from these absent documents is assumed.

## 2. Material conflicts and how they are resolved

Precedence applied, as S1 instructs: explicit prompt instructions, then the latest approved Phase 1 pack and amendments, then the remaining Markdown specifications, then older proposals.

| # | Conflict | Resolution |
| --- | --- | --- |
| C1 | S1 section 5 asks for the ten agency modules. S2, S3, S5 and S9 put a clinic website and lead backend first and defer the ten modules. | Both are in progress in parallel: S12 (`clinic-demo-a`) delivers the Phase 1 website and lead pilot; this repository delivers the agency platform from S1 on the shared foundation (clients, websites, staff, roles, audit, design system). Lead records stay in S12 so there is one source of truth; a later integration reads them into this platform. Recorded in DECISIONS.md D1. |
| C2 | S1 says the user's current date constraint is 19 Oct start, 23 Oct first working draft, 20 working days. S3 `20_DELIVERY_TIMELINE.md` uses relative working days. S5 gives exact dates. | S5 is the calendar authority. 23 Oct = Day 5 = Milestone 1: responsive site, technical SEO, staging link. |
| C3 | Navigation: S1 lists Dashboard, Clients, My Tasks, Approvals, SEO, Google Ads, Issues, Medical Review, Reports, Timeline, Admin. S3 `15_DESIGN_SYSTEM.md` says Phase 1 shell is Websites, Enquiries, Notification status, Settings and "add future modules only when implemented". | Phase 1 shell: Overview, Clients and websites, Enquiries, Notifications, Admin. Agency modules appear when built, not as empty placeholders. |
| C4 | Typography: S1 mandates Plus Jakarta Sans everywhere. S3 `15_DESIGN_SYSTEM.md` says Helvetica/Arial fallback. | Plus Jakarta Sans for the Control Centre (S1 explicitly overrides older typography). Public clinic sites keep their own brand type (S3 `06`, `15`). |
| C5 | Demo Clinic A pages and form fields: S9 CG-01 records seven practice routes and name + email only. S4 specifies five Stage 1 pages, twelve Stage 2 pages, and a richer appointment form (name, contact number, optional email, reason, preferred date and time window, short message). | Site pages and form fields are configuration per website and form version, so either set can be approved later. The build ships S4 Stage 1 pages plus privacy and 404, with the S4 field set as form version 1, labelled proposed and not approved. S9 remains the earlier practice record. |
| C6 | Product name: S9 DAY-01 says "Genie Works". S1 says use Clinic Genie. | Clinic Genie (S1 explicit instruction). |
| C7 | S9 DAY-01 test asserts the repository has no `package.json`, `apps/` or `.github`. This build adds them. | The DAY-01 snapshot is now historical. Its checker hard-codes the empty-repository state, so that test is expected to fail after this build; it is left unmodified because it is uncommitted prior work by another session. Noted in BUILD_STATUS. |
| C8 | Stack: S1 default is Next.js + Supabase. S3 `01` says Supabase is a candidate, not selected, and no paid vendor without approval. No Docker, Homebrew, Supabase CLI or Postgres exists on this machine. | Next.js + TypeScript + Tailwind. PostgreSQL via a local embedded binary for development; `DATABASE_URL` for any managed Postgres (Supabase-compatible SQL, row-level security policies included). Managed auth provider is unselected: Auth.js with a dev magic-link flow now and a Google Workspace OAuth provider enabled by environment variables when approved. No vendor account is created. |
| C9 | S1 says "Do not reintroduce website request/revision/QA tracking". S3 and S4 require engineering QA evidence. | Engineering QA (acceptance tests, QA evidence) is kept. No agency QA-tracking module is built. |

## 3. Requirements matrix (agency platform)

Routes are in `apps/platform`. Acceptance checks: the file `18_ACCEPTANCE_TESTS.md` on disk belongs to the website pack, so checks here are the ones defined in `docs/ACCEPTANCE.md` (A-01 onwards) and run by `npm test`.

| Req | Requirement | Source | Route | Data entity | Acceptance |
| --- | --- | --- | --- | --- | --- |
| R1 | Client profiles: accountable owner, status, active channels, notes, persistent IDs, archive and restore, activity | S1 §5 Clients; S7 p4 | `/clients`, `/clients/[id]` | clients, memberships | A-01, A-02 |
| R2 | Linked websites and account references (saved link + identifier, vault reference, never passwords) | S1 §5 Clients | `/clients/[id]` profile tab | websites, account_references | A-03 |
| R3 | Staff roles admin, manager, specialist, reviewer, read_only; scoped reviewer access; enforced on every server action and query; row-level security | S1 §6 | `/admin/users` | staff_users, memberships | A-04, A-05, A-06 |
| R4 | Managed sign-in with server-side access resolution | S1 §6; S3 03 | `/sign-in` | Auth.js tables | A-05 |
| R5 | Dashboard: urgent, due today, waiting, upcoming; deterministic score with stable tie-break; Asia/Singapore boundaries; completed and cancelled excluded; quick actions save and refresh | S1 §5 Dashboard; S8 | `/`, `/my-tasks` | tasks | A-07, A-08 |
| R6 | Tasks: one accountable owner; High/Critical require due date; Waiting requires waiting-on and follow-up date; status history preserved; client-scoped related record selectors | S1 §5 Tasks | `/clients/[id]/tasks`, `/tasks/[id]` | tasks, task_history | A-09, A-10 |
| R7 | Approvals: draft, submission, authorised decision, changes requested, supersession; decisions append-only; linked to record and timeline | S1 §5 Approvals | `/approvals`, `/approvals/[id]` | approvals, approval_decisions | A-11, A-12 |
| R8 | SEO: page mapping, keywords, intent, content status, review dates, before/after change records, manual mapping flags; no implied crawling | S1 §5 SEO | `/seo`, `/clients/[id]/seo` | seo_pages, seo_changes | A-13 |
| R9 | Google Ads: audits, review periods, scoped findings, recommendations, implemented changes with before/after, reason, responsible staff, approval reference, verification date, outcome; records only | S1 §5 Google Ads | `/google-ads`, `/clients/[id]/google-ads` | ads_audits, ads_findings, ads_changes | A-14 |
| R10 | Issues: open, investigating, resolved pending verification, verified closed, reopened; verifier, date, result; evidence under the correct client; private uploads with authorised retrieval or validated links | S1 §5 Issues | `/issues`, `/issues/[id]` | issues, issue_history, evidence_items | A-15, A-16 |
| R11 | Medical review: claims, wording versions, reviewer assignment, sources, decisions; earlier reviews preserved when wording changes; no "approved" for unsupported claims; status is not regulatory certification | S1 §5 Medical review | `/medical-review`, `/medical-review/[id]` | medical_claims, claim_wordings, medical_reviews, medical_sources | A-17 |
| R12 | Reports: immutable snapshots (client, source, channel, metric, period); like-for-like comparisons; absolute and percentage movement only when valid; missing is unavailable not zero; zero baseline never infinity; clicks, enquiries, appointments, patients distinct; observations separate from explanations | S1 §5 Reports | `/reports`, `/clients/[id]/reports` | report_snapshots, report_notes | A-18, A-19 |
| R13 | Timeline: linked material events generated by workflows in the same transaction; no duplicates on retry; observed movement distinct from causation; separate from the security audit log | S1 §5 Timeline | `/timeline`, `/clients/[id]/timeline` | timeline_events | A-20 |
| R14 | Admin: users, roles, client access, audit history, backup status and recovery records; status only from recorded runs | S1 §5 Admin | `/admin/*` | audit_events, backup_runs | A-21 |
| R15 | Design: Plus Jakarta Sans, aqua #DDF7F8, light mode, left sidebar, compact utility bar, client context, drawers that keep list position, 8 px rhythm, accessible, status not by colour alone, British English, no em dashes, responsive | S1 §4; S3 15; S8 | all | n/a | manual review, A-22 |
| R16 | Seed: 2 to 3 fictional clients with overdue tasks, waiting follow-ups, decisions, SEO and Ads changes, issues, sources and comparable periods; idempotent; refuses production targets | S1 §8 | `npm run db:seed` | all | A-23 |
| R17 | Backup and restore into an isolated target with relationship checks; result recorded; never a green badge from configuration alone | S1 §5 Admin, §8 | `npm run db:backup`, `npm run db:restore-test` | backup_runs | A-24 |
| R18 | BUILD_STATUS, requirements checklist, decisions log, handover with environment variable names only | S1 §7, §8 | docs/ | n/a | handover |

## 4. Deferred and blocked

- Hybrid website layer and Wix categories: blocked pending the approved category list. No category names are invented.
- Integration of `clinic-demo-a` enquiries into this platform: later ticket, after both repositories are stable.
- Live APIs (GA4, Search Console, Google Ads), automated audits and AI recommendations: later phases. Manual entry only now.
- Website request/revision/QA tracking, recurring deliverables, social/design/video tracking, Service Delivery Tracker: excluded.

## 5. Blocked pending source material or decisions

- Hybrid website layer categories and the approved Wix category list: not supplied. No category names are invented.
- Managed database vendor and region, managed auth provider, transactional email provider and sender domain, Vercel plan, GA4 and Search Console properties, clinic recipient mailbox, booking provider: not selected. Environment variable names are provided; no accounts are created.
- Independent security reviewer and release approver: not named.
- Clinic-approved copy, form wording and privacy notice: not approved. Everything patient-facing is labelled draft and fictional.
