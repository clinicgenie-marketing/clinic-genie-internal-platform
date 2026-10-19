# Build tickets CG-01 to CG-18

Use the source PDF's ticket IDs. Tickets are build units, not a promise of one ticket per day. Before coding each ticket, expand it into: objective, why, dependencies, expected files, inputs/outputs, security implications, steps, exclusions, tests, evidence, rollback, owner and due date.

| Ticket | Scope | Dependency / done evidence |
| --- | --- | --- |
| CG-01 | Audit code, pilot needs, providers and architecture | First; scope, gap list and decision log signed |
| CG-02 | Repository, branch rules, staging and deploy approach | CG-01; reproducible staging and recovery reference |
| CG-03 | Clients, sites and memberships migrations | CG-02; two test clients/sites, relationship checks |
| CG-04 | Managed staff login and enforced permissions | CG-03; authenticated cross-client denial proof |
| CG-05 | Reusable configured website starter | CG-02/03; responsive clinic template on staging |
| CG-06 | Metadata, sitemap, robots, redirects and schema | CG-05; actual rendered-output checks |
| CG-07 | Form contract, validation, consent and anti-spam | CG-01/03; contract and valid/invalid test evidence |
| CG-08 | Durable submission, dedupe and atomic outbox | CG-07; concurrency and failure tests |
| CG-09 | Email adapter, clinic routing and retries | CG-08; outage/recovery and correct recipient proof |
| CG-10 | Protected lead list, status and export | CG-04/08/09; tenant-only access and audit evidence |
| CG-11 | Booking modes and fallback | CG-05/07-09; enquiry/external mobile tests |
| CG-12 | GA4/GSC and optional Ads events | CG-06/08/11; correct source IDs, no PII/duplicate goals |
| CG-13 | Uptime, errors and synthetic form monitoring | CG-08/09; simulated outage reaches owner |
| CG-14 | Backup/restore and migration recovery | CG-03/08; non-production restore proof |
| CG-15 | Security testing and independent review | CG-04/07-14; critical/high findings closed |
| CG-16 | Browser/mobile/accessibility/performance/SEO QA | CG-05-12; critical defects fixed, evidence attached |
| CG-17 | Second dummy-site configuration dry run | CG-03-12; independent configuration, same backend |
| CG-18 | Controlled release, live verification and handover | All relevant tickets, CG-17 and G1-G5; sign-off and owner |

CG-17 belongs before final launch even though its identifier follows CG-16. Provider decisions must precede integration work. Add a dedicated migration ticket and revise estimates if the pilot replaces Wix. A missing dependency blocks completion rather than being silently mocked in acceptance evidence.
