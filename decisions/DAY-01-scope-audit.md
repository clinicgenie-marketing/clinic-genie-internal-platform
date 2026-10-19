# DAY-01 scope sheet, code audit, and access checklist

Task: DAY-01. Date: 19 October 2026. Covers: CG-01 and CG-02. Status: scope frozen, reviewer not booked.

This file freezes the practice scope and records an inspection of the repository. It does not create Demo Clinic A, connect a host, open a database, or book a person.

Product name: Genie Works. Build path: new build. Live Wix stays unchanged. Booking method: ENQUIRY. Security reviewer: not booked. No provider access is confirmed.

The frozen pilot choices live in [CG-01-pilot-scope.md](CG-01-pilot-scope.md). This sheet does not replace that record.

## Scope sheet

| Item | Frozen choice | Still blocked |
| --- | --- | --- |
| Product name | Genie Works | The GitHub repository and older specification files still use Clinic Genie |
| Pilot website | Demo Clinic A, synthetic | Real clinic and owner are unnamed |
| Build path | New build beside the current Wix site | Any later cutover needs its own decision |
| Live Wix | Unchanged. No migration ticket | The live URL is unknown |
| Pages | Seven practice routes in the CG-01 inventory | Clinic has not approved the copy |
| Forms | `contact` and `appointment-enquiry`; name and email only | Wording is not approved |
| Booking mode | ENQUIRY. The visitor is told the request was received | Calendar owner is unknown |
| Production URL | Unknown | Do not invent one |
| Staging URL | Unknown | CG-02 approach is written below. No staging site exists |
| Approvals | Not granted | Owner, medical, marketing, privacy, security, and release |

## Existing-code audit

Inspected on 19 October 2026 without changing the specification pack. The working branch at inspection was `cursor/cg-01-pilot-scope-a202`, commit `12df501`. `main` is commit `562638d`.

| Looked for | Result |
| --- | --- |
| Application or website code | None. No `apps/` directory and no pages to open. |
| Framework | None selected. Next.js is a recommendation in the scope file, not a dependency. |
| `package.json`, lockfile, or test script in package metadata | None. The CG-01 check runs with Node's built-in test runner. |
| Wix project or export | None. The live site is not in this repository. |
| `.env`, credentials, or provider keys | None in the project files. |
| CI workflow | None. No `.github` directory. |
| Staging or production deploy | None. |
| Reusable UI components | None. There is nothing to reuse yet. |
| Specification pack | 21 Markdown files, `00_README.md` through `20_DELIVERY_TIMELINE.md`. |
| Earlier practice record | `decisions/CG-01-pilot-scope.md` plus its checker and test. |

GitHub CLI is not available in this environment, so branch protection and admin rights were not confirmed. The Git remote is `https://github.com/clinicgenie-marketing/clinic-genie-internal-platform`.

## Branch rules

These rules apply from this task onward. They are written policy. They are not a GitHub setting, because that access was not confirmed.

- Do practice work on a feature branch. Leave `main` as the specification pack until a reviewed change is merged.
- Do not force-push `main`.
- Do not commit secrets, patient data, or real clinic contact details.
- Do not deploy from DAY-01.

## Staging and recovery approach

No host is connected. Vercel is named in `01_PRODUCT_SCOPE.md` as the intended kind of host, and the plan or tier is not selected. Supabase is a database candidate in that same file, not a selected vendor.

| Step | When | This task |
| --- | --- | --- |
| Keep staging and production separate | Before the first deploy | Recorded only |
| Protect preview sites from public indexing | When a preview URL exists | No URL exists |
| Recovery | Now | Revert this documentation commit. There is no database or live deploy to roll back |
| Later schema recovery | CG-14 | Not claimed here |

Creating the Vercel project, a database, or a paid plan needs your approval before the next task connects it.

## Access checklist

| Access | Status | Evidence |
| --- | --- | --- |
| GitHub repository | The remote exists. Admin rights and branch protection were not confirmed | Git remote only. `gh` was not installed |
| Vercel | Not confirmed | No project id, team, or token |
| Managed database | Not confirmed | No vendor or region selected |
| Managed login | Not confirmed | No auth project |
| Email provider and sender domain | Not confirmed | No sender domain |
| Clinic notification recipient | Not set | Left empty so a real address is not invented |
| Booking provider | Not used. Mode is ENQUIRY | CG-01 booking decision |
| GA4 | Not confirmed | No measurement id |
| Google Search Console | Not confirmed | No property |

## Security reviewer

Security reviewer: not booked.

An independent reviewer is required before any real patient data. This file has no reviewer name, date, or proof. An unsigned reader cannot book that reviewer by editing the status alone.

To book the reviewer, reply with the person's name, the date they agreed, and how you know they are independent of the build. I will then update this sheet. I will not invent a name.

## Tests

`tests/day-01-scope-audit.test.mjs` checks this sheet and the repository.

| Case | What is checked |
| --- | --- |
| Normal | The frozen scope matches CG-01, the audit matches the files on disk, and every provider stays unconfirmed. |
| Failure | A Wix migration, an invented staging URL, a confirmed provider, a booked reviewer with no name, or a paid connection is rejected. |
| Unauthorised | An unsigned reader cannot book the reviewer or connect a provider. A public visitor cannot edit live Wix. An unassigned operator cannot mark staging live. |

## Evidence to capture

- The output of `node --test tests/day-01-scope-audit.test.mjs`.
- The output of `node --test tests/cg-01-pilot-scope.test.mjs`.
- This file at the commit you keep.

Do not capture secrets, patient details, or a screenshot of a site. There is no site.

## Rollback

Delete this file, `decisions/day-01-checks.mjs`, and `tests/day-01-scope-audit.test.mjs`. Remove the DAY-01 pointers in `00_README.md` and `17_BUILD_TICKETS.md`. Demo Clinic A, Wix, and any provider account stay as they were.

```day01
{
  "task": "DAY-01",
  "covers": ["CG-01", "CG-02"],
  "status": "scope-frozen-reviewer-not-booked",
  "inspectedOn": "2026-10-19",
  "scopeSheet": {
    "source": "decisions/CG-01-pilot-scope.md",
    "productName": "Genie Works",
    "pilotWebsiteId": "demo-clinic-a",
    "buildPath": "new-build",
    "liveWixChangePermitted": false,
    "bookingMode": "ENQUIRY",
    "pageCount": 7,
    "productionUrl": null,
    "stagingUrl": null,
    "liveWixUrl": null,
    "approvalsGranted": false
  },
  "codeAudit": {
    "applicationCode": false,
    "frameworkSelected": false,
    "packageManifest": false,
    "wixProjectPresent": false,
    "envFilePresent": false,
    "ciWorkflowPresent": false,
    "stagingDeployExists": false,
    "specFileCount": 21
  },
  "branchRules": {
    "workOnFeatureBranches": true,
    "protectMainFromForcePush": true,
    "commitSecrets": false,
    "deployFromThisTask": false
  },
  "deployApproach": {
    "hostConnected": false,
    "host": null,
    "stagingUrl": null,
    "productionUrl": null,
    "recovery": "git-revert-docs-only"
  },
  "access": {
    "githubRepository": "exists-admin-not-confirmed",
    "vercel": "not-confirmed",
    "database": "not-confirmed",
    "auth": "not-confirmed",
    "email": "not-confirmed",
    "bookingProvider": "not-used-enquiry-only",
    "ga4": "not-confirmed",
    "gsc": "not-confirmed"
  },
  "securityReviewer": {
    "status": "not-booked",
    "name": null,
    "independent": null,
    "bookedFor": null,
    "evidence": null
  },
  "unauthorised": {
    "unsignedReaderMayBookReviewer": false,
    "unsignedReaderMayConnectProvider": false,
    "publicVisitorMayEditLiveWix": false,
    "unassignedOperatorMayMarkStagingLive": false
  },
  "schemaChange": false,
  "secretsIntroduced": false,
  "providerConnection": false,
  "paidServiceIntroduced": false
}
```
