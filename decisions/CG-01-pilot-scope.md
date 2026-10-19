# CG-01 pilot scope

Ticket: CG-01. Inspected: 19 October 2026. Status: recorded, not signed.

This file decides which website the practice build uses and which pages that practice includes. It does not launch a clinic site, change a live Wix site, choose a paid vendor, or approve medical copy.

Pilot clinic: Demo Clinic A. Build path: new build. Live Wix stays unchanged. Booking method: ENQUIRY. This decision log is not signed.

## What the repository already contained

The repository is the Clinic Genie specification pack (21 Markdown files). It is not an application. There is no website code, no Wix export, no domain, and no named real clinic.

| Already written | What it decides | What it leaves open |
| --- | --- | --- |
| `01_PRODUCT_SCOPE.md` | Start with one controlled clinic website. Replace essential Wix-dependent functions later, behind gates. | The actual clinic, owner, and page list. |
| `06_WEBSITE_STARTER_SEO.md` | Prefer a new website pilot. Use a minimal demonstration page set until the clinic approves content. A Wix migration needs its own ticket. | The page names and any current Wix URL. |
| `07_FORMS_LEAD_CAPTURE.md` | Contact and appointment enquiry. Example fields are name and email. No NRIC, history, or documents. | Clinic-approved wording and any extra fields. |
| `09_BOOKING_CONNECTIONS.md` | Enquiry mode says the request was received. It must not say an appointment is confirmed. | Who owns the real calendar. |
| `19_SEED_DATA_TEST_PLAN.md` | Practice names are Demo Clinic A and Demo Clinic B. Contacts stay synthetic (`example.invalid`). | A real clinic may be configured only after someone selects it. |
| `12_MEDICAL_PRIVACY_APPROVALS.md` | Unknown approvals are blockers. They are not implied consent. | Every named approver. |
| `17_BUILD_TICKETS.md` | CG-01 is first. Done evidence is a scope note, a gap list, and a decision log. | Nothing in that table was signed. |

Demo Clinic B is the later reuse proof (CG-17). It is not this pilot.

## Decision register

Costs below are for this ticket only. No paid service is introduced.

| Decision | Options | Choice | Owner | Cost | Evidence | Blocker |
| --- | --- | --- | --- | --- | --- | --- |
| First practice website | A real clinic named in this repo; Demo Clinic A; Demo Clinic B | Demo Clinic A, synthetic | Clinic owner unassigned | $0 | `19_SEED_DATA_TEST_PLAN.md`. No real clinic name exists in the repo. | Yes. Real clinic and owner are not identified. |
| New build versus Wix migration | New build beside the current Wix site; migrate and replace Wix | New build | Not signed | $0 | `06_WEBSITE_STARTER_SEO.md` prefers a new pilot. This task says to keep live Wix unchanged. | No for practice work. Yes before any real cutover. |
| Required public pages | Invent a large clinic site; use a short demonstration set | Short demonstration set below | Clinic content approver unassigned | $0 | Page paths are a practice inventory, not approved copy. | Yes. Content is not approved. |
| Forms | Contact and appointment enquiry with name and email; add clinical free text | Name and email only, on two proposed forms | Clinic approver unassigned | $0 | `07_FORMS_LEAD_CAPTURE.md` example. | Yes. Wording is not approved. |
| Booking method | Enquiry; external link; booking API | ENQUIRY | Calendar owner unknown | $0 | `09_BOOKING_CONNECTIONS.md`. Demo Clinic A uses enquiry mode in the seed plan. | Yes before any external or API booking. |
| Current URLs | Record a guessed Wix or staging URL; record unknown | Production, staging, and live Wix URLs are unknown | Domain owner unknown | $0 | No URL is stored in this repository. | Yes. |
| Stakeholder approvals | Treat the spec as approval; leave them unsigned | Not granted | See approval table | $0 | `12_MEDICAL_PRIVACY_APPROVALS.md` | Yes. |

Repository URL, which is not a clinic website: `https://github.com/clinicgenie-marketing/clinic-genie-internal-platform`.

## Page inventory

These routes are the practice set for Demo Clinic A. Placeholder text must not invent doctors, prices, treatments, or patient stories. The clinic has not approved them.

| Path | Page | In the public sitemap | Purpose |
| --- | --- | --- | --- |
| `/` | Home | Yes | Practice homepage. |
| `/services` | Services | Yes | Placeholder service list. No medical claims. |
| `/about` | About | Yes | Placeholder clinic description. No invented practitioner facts. |
| `/contact` | Contact | Yes | Contact form. |
| `/appointment` | Appointment enquiry | Yes | Enquiry form. Matches the sample `pagePath` in the form contract. |
| `/privacy` | Privacy notice | Yes | Notice version required before any real personal information. |
| `/404` | Page not found | No | Unknown routes return a real 404. |

### Forms

Both forms are proposed, not approved. Accepted fields are `name` and `email` only. Do not add NRIC, medical history, symptoms, or clinical documents.

| Form key | Page | What the visitor is told |
| --- | --- | --- |
| `contact` | `/contact` | The message was received. |
| `appointment-enquiry` | `/appointment` | The request was received. The clinic will contact them. This is not an appointment confirmation. |

### Booking method

Mode: ENQUIRY. The clinic confirms manually, outside this website. There is no external booking link and no booking API on this pilot. A click is not a booking.

## URLs

| URL | Value |
| --- | --- |
| Repository | `https://github.com/clinicgenie-marketing/clinic-genie-internal-platform` |
| Production clinic website | Unknown. Do not invent one. |
| Staging website | Unknown. CG-02 has not created it. |
| Live Wix website | Unknown. Do not invent one, and do not change the live site. |

## Stakeholder approvals

None of these are granted. An unsigned reader cannot fill them in by editing this file without a real approver and evidence.

| Approval | Status |
| --- | --- |
| Clinic owner identified and signed | Not granted. Name is unassigned. |
| Medical or factual content | Not granted. |
| Marketing content | Not granted. |
| Privacy notice | Not granted. |
| Independent security review | Not granted. |
| Release / go-live | Not granted. |
| Permission to edit live Wix | Not granted. This ticket forbids that edit. |

## Exclusions

Kept out of this pilot:

- Edits to the live Wix site, including content, domains, redirects, and analytics.
- A Wix migration ticket. Add one only if a later decision replaces Wix.
- Demo Clinic B, other real clinics, and a second live website.
- Real patient data, production contact details, NRIC, medical history, symptoms, and clinical documents.
- Paid services, database schema changes, secrets, and provider connections (hosting, database, login, email, analytics, booking).
- Custom calendar, booking API, and an external booking button on Demo Clinic A.
- Patient portal, payments, blog, shop, custom CMS, and full CRM.
- Fabricated practitioner facts, testimonials, or medical claims.
- The older dashboard-first brief and unspecified Wix categories.
- Staff admin screens. Those belong to later tickets, not this public page list.

## Gap list

1. No application code, framework, or deploy setup exists yet.
2. No real clinic, clinic owner, or content approver is named.
3. No production, staging, or Wix URL is recorded.
4. Pages and forms above are a practice inventory. Copy is not approved.
5. Booking stays enquiry-only because the calendar owner and any external provider are unknown.
6. Database, login, email, and analytics vendors are not selected. This ticket does not select them.
7. CG-02 through CG-18 have not started. A missing approval blocks launch. It does not block this written record.

## Risks

- Treating Demo Clinic A as a real clinic, or inventing an owner, URL, or approval, would make later tests look finished when they are not.
- Changing the live Wix site during practice can break the clinic's current public site. This record forbids that.
- Adding a message box now makes it easy to collect symptoms. Extra fields wait for clinic approval.
- Building CG-05 pages before this inventory existed would let the page list drift. Later tickets should follow this list until the clinic replaces it.
- This document is safe to commit only while it stays free of secrets and real personal data.

## Tests

`tests/cg-01-pilot-scope.test.mjs` checks the machine-readable record in the block below.

| Case | What is checked |
| --- | --- |
| Normal | The committed record names Demo Clinic A, new build, the seven pages, enquiry booking, unknown URLs, unsigned approvals, and the exclusions. |
| Failure | A filled-in Wix URL, a granted approval, a confirmed appointment, a Wix migration, a schema or provider change, or a forbidden form field is rejected. |
| Unauthorised | An unsigned reader cannot launch, a public visitor cannot edit live Wix, and an unassigned operator cannot grant approvals or read future leads. |

## Rollback

Delete this file, `decisions/cg-01-checks.mjs`, and `tests/cg-01-pilot-scope.test.mjs`, and remove the CG-01 pointers in `00_README.md` and `17_BUILD_TICKETS.md`. No database, site, or Wix change exists to undo.

```cg01
{
  "ticket": "CG-01",
  "status": "recorded-not-signed",
  "inspectedOn": "2026-10-19",
  "repository": {
    "url": "https://github.com/clinicgenie-marketing/clinic-genie-internal-platform",
    "containsApplicationCode": false,
    "containsLiveWixProject": false
  },
  "pilot": {
    "websiteId": "demo-clinic-a",
    "displayName": "Demo Clinic A",
    "synthetic": true,
    "realClinicSelected": false,
    "role": "first-practice-website",
    "clinicOwner": {
      "name": null,
      "status": "unassigned",
      "blocker": true
    }
  },
  "buildPath": "new-build",
  "liveWix": {
    "changePermitted": false,
    "status": "unchanged-out-of-scope",
    "currentUrl": null,
    "migrationTicketAdded": false
  },
  "pages": [
    {"path": "/", "name": "Home", "indexable": true, "contentStatus": "placeholder-pending-approval"},
    {"path": "/services", "name": "Services", "indexable": true, "contentStatus": "placeholder-pending-approval"},
    {"path": "/about", "name": "About", "indexable": true, "contentStatus": "placeholder-pending-approval"},
    {"path": "/contact", "name": "Contact", "indexable": true, "contentStatus": "placeholder-pending-approval"},
    {"path": "/appointment", "name": "Appointment enquiry", "indexable": true, "contentStatus": "placeholder-pending-approval"},
    {"path": "/privacy", "name": "Privacy notice", "indexable": true, "contentStatus": "placeholder-pending-approval"},
    {"path": "/404", "name": "Page not found", "indexable": false, "contentStatus": "required-error-page"}
  ],
  "forms": [
    {
      "formKey": "contact",
      "pagePath": "/contact",
      "status": "proposed-not-approved",
      "fields": ["name", "email"],
      "forbiddenFields": ["nric", "medicalHistory", "clinicalDocuments", "symptoms"]
    },
    {
      "formKey": "appointment-enquiry",
      "pagePath": "/appointment",
      "status": "proposed-not-approved",
      "fields": ["name", "email"],
      "forbiddenFields": ["nric", "medicalHistory", "clinicalDocuments", "symptoms"]
    }
  ],
  "booking": {
    "mode": "ENQUIRY",
    "impliesAppointmentConfirmed": false,
    "wording": "request-received",
    "externalDestination": null,
    "apiIntegration": false
  },
  "urls": {
    "repository": "https://github.com/clinicgenie-marketing/clinic-genie-internal-platform",
    "productionWebsite": null,
    "stagingWebsite": null,
    "liveWix": null
  },
  "approvals": {
    "clinicOwner": {"status": "not-granted", "evidence": null},
    "medicalContent": {"status": "not-granted", "evidence": null},
    "marketingContent": {"status": "not-granted", "evidence": null},
    "privacyNotice": {"status": "not-granted", "evidence": null},
    "securityReview": {"status": "not-granted", "evidence": null},
    "release": {"status": "not-granted", "evidence": null},
    "liveWixEdit": {"status": "not-granted", "evidence": null}
  },
  "exclusions": [
    "live-wix-edits",
    "wix-migration",
    "real-patient-data",
    "paid-services",
    "database-schema-changes",
    "secrets",
    "provider-connections",
    "custom-calendar",
    "booking-api",
    "external-booking-for-pilot",
    "nric-history-documents",
    "patient-portal",
    "custom-cms",
    "full-crm",
    "second-live-clinic",
    "fabricated-practitioner-facts",
    "dashboard-first-brief"
  ],
  "unauthorised": {
    "unsignedReaderMayLaunch": false,
    "publicVisitorMayEditLiveWix": false,
    "unassignedOperatorMayChangeApprovals": false,
    "anonymousCallerMayReadFutureLeads": false
  },
  "schemaChange": false,
  "secretsIntroduced": false,
  "providerConnection": false,
  "paidServiceIntroduced": false
}
```
