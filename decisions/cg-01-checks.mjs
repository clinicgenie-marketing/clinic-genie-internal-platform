/**
 * Checks the CG-01 pilot decision record.
 * The committed Markdown file is the source. Tests pass copies with bad edits.
 */

const REQUIRED_PHRASES = [
  "Pilot clinic: Demo Clinic A",
  "Build path: new build",
  "Live Wix stays unchanged",
  "Booking method: ENQUIRY",
  "This decision log is not signed",
];

const REQUIRED_PAGES = [
  ["/", "Home", true, "placeholder-pending-approval"],
  ["/services", "Services", true, "placeholder-pending-approval"],
  ["/about", "About", true, "placeholder-pending-approval"],
  ["/contact", "Contact", true, "placeholder-pending-approval"],
  ["/appointment", "Appointment enquiry", true, "placeholder-pending-approval"],
  ["/privacy", "Privacy notice", true, "placeholder-pending-approval"],
  ["/404", "Page not found", false, "required-error-page"],
];

const REQUIRED_EXCLUSIONS = [
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
  "dashboard-first-brief",
];

const APPROVAL_KEYS = [
  "clinicOwner",
  "medicalContent",
  "marketingContent",
  "privacyNotice",
  "securityReview",
  "release",
  "liveWixEdit",
];

const FORBIDDEN_FIELDS = ["nric", "medicalHistory", "clinicalDocuments", "symptoms"];

export function extractRecord(markdown) {
  const match = markdown.match(/```cg01\n([\s\S]*?)\n```/);
  if (!match) {
    throw new Error("CG-01 record block is missing");
  }
  return JSON.parse(match[1]);
}

function sameList(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    expected.every((item, index) => actual[index] === item)
  );
}

export function validateRecord(record, markdown = "") {
  const errors = [];

  if (!record || typeof record !== "object") {
    return ["record must be an object"];
  }

  if (markdown) {
    for (const phrase of REQUIRED_PHRASES) {
      if (!markdown.includes(phrase)) {
        errors.push(`missing required phrase: ${phrase}`);
      }
    }
  }

  if (record.ticket !== "CG-01" || record.status !== "recorded-not-signed") {
    errors.push("ticket must stay CG-01 and recorded-not-signed");
  }
  if (record.repository?.containsApplicationCode !== false) {
    errors.push("repository has no application code");
  }
  if (record.repository?.containsLiveWixProject !== false) {
    errors.push("repository does not contain the live Wix project");
  }

  const pilot = record.pilot ?? {};
  if (pilot.websiteId !== "demo-clinic-a" || pilot.displayName !== "Demo Clinic A") {
    errors.push("pilot must be Demo Clinic A");
  }
  if (pilot.synthetic !== true || pilot.realClinicSelected !== false) {
    errors.push("pilot must stay synthetic until a real clinic is chosen");
  }
  if (pilot.role !== "first-practice-website") {
    errors.push("pilot role must be the first practice website");
  }
  if (
    pilot.clinicOwner?.name !== null ||
    pilot.clinicOwner?.status !== "unassigned" ||
    pilot.clinicOwner?.blocker !== true
  ) {
    errors.push("clinic owner is unassigned and remains a blocker");
  }

  if (record.buildPath !== "new-build") {
    errors.push("build path must be new-build");
  }

  const wix = record.liveWix ?? {};
  if (
    wix.changePermitted !== false ||
    wix.status !== "unchanged-out-of-scope" ||
    wix.currentUrl !== null ||
    wix.migrationTicketAdded !== false
  ) {
    errors.push("live Wix stays unchanged and has no migration ticket");
  }

  if (!Array.isArray(record.pages) || record.pages.length !== REQUIRED_PAGES.length) {
    errors.push("page inventory must list the seven practice pages");
  } else {
    REQUIRED_PAGES.forEach(([path, name, indexable, contentStatus], index) => {
      const page = record.pages[index];
      if (
        page?.path !== path ||
        page?.name !== name ||
        page?.indexable !== indexable ||
        page?.contentStatus !== contentStatus
      ) {
        errors.push(`page inventory mismatch at ${path}`);
      }
    });
  }

  const forms = record.forms ?? [];
  const contact = forms.find((form) => form.formKey === "contact");
  const enquiry = forms.find((form) => form.formKey === "appointment-enquiry");
  if (forms.length !== 2 || !contact || !enquiry) {
    errors.push("forms must be contact and appointment-enquiry only");
  }
  for (const form of [contact, enquiry]) {
    if (!form) continue;
    if (form.status !== "proposed-not-approved") {
      errors.push(`${form.formKey} is not approved`);
    }
    if (!sameList(form.fields, ["name", "email"])) {
      errors.push(`${form.formKey} accepts name and email only`);
    }
    if (!sameList(form.forbiddenFields, FORBIDDEN_FIELDS)) {
      errors.push(`${form.formKey} must forbid clinical fields`);
    }
    if (form.fields?.some((field) => FORBIDDEN_FIELDS.includes(field))) {
      errors.push(`${form.formKey} includes a forbidden field`);
    }
  }
  if (contact?.pagePath !== "/contact" || enquiry?.pagePath !== "/appointment") {
    errors.push("forms must stay on their own pages");
  }

  const booking = record.booking ?? {};
  if (
    booking.mode !== "ENQUIRY" ||
    booking.impliesAppointmentConfirmed !== false ||
    booking.wording !== "request-received" ||
    booking.externalDestination !== null ||
    booking.apiIntegration !== false
  ) {
    errors.push("booking must be an unconfirmed enquiry");
  }

  const urls = record.urls ?? {};
  if (urls.productionWebsite !== null || urls.stagingWebsite !== null || urls.liveWix !== null) {
    errors.push("clinic website URLs are unknown and must stay empty");
  }
  if (urls.repository !== "https://github.com/clinicgenie-marketing/clinic-genie-internal-platform") {
    errors.push("repository URL changed");
  }

  for (const key of APPROVAL_KEYS) {
    const approval = record.approvals?.[key];
    if (approval?.status !== "not-granted" || approval?.evidence !== null) {
      errors.push(`${key} approval must stay not-granted`);
    }
  }

  if (!sameList(record.exclusions, REQUIRED_EXCLUSIONS)) {
    errors.push("exclusions changed");
  }

  const access = record.unauthorised ?? {};
  if (access.unsignedReaderMayLaunch !== false) {
    errors.push("an unsigned reader must not launch");
  }
  if (access.publicVisitorMayEditLiveWix !== false) {
    errors.push("a public visitor must not edit live Wix");
  }
  if (access.unassignedOperatorMayChangeApprovals !== false) {
    errors.push("an unassigned operator must not change approvals");
  }
  if (access.anonymousCallerMayReadFutureLeads !== false) {
    errors.push("an anonymous caller must not read future leads");
  }

  if (record.schemaChange !== false) errors.push("schema change is outside CG-01");
  if (record.secretsIntroduced !== false) errors.push("secrets are outside CG-01");
  if (record.providerConnection !== false) errors.push("provider connection is outside CG-01");
  if (record.paidServiceIntroduced !== false) errors.push("paid service is outside CG-01");

  return errors;
}
