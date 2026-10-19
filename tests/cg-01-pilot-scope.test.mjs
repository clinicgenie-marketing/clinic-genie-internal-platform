import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { extractRecord, validateRecord } from "../decisions/cg-01-checks.mjs";

const decisionPath = new URL("../decisions/CG-01-pilot-scope.md", import.meta.url);
const markdown = readFileSync(decisionPath, "utf8");

function committedRecord() {
  return extractRecord(markdown);
}

test("normal: committed pilot record passes", () => {
  const record = committedRecord();
  assert.deepEqual(validateRecord(record, markdown), []);
  assert.equal(record.pilot.displayName, "Demo Clinic A");
  assert.equal(record.buildPath, "new-build");
  assert.equal(record.booking.mode, "ENQUIRY");
  assert.equal(record.pages.length, 7);
  assert.equal(record.urls.liveWix, null);
  assert.ok(record.exclusions.includes("real-patient-data"));
  assert.ok(record.exclusions.includes("live-wix-edits"));
});

test("failure: invented URL, granted approval, or confirmed booking is rejected", () => {
  const withWixUrl = committedRecord();
  withWixUrl.liveWix.currentUrl = "https://example-clinic.wixsite.com/live";
  withWixUrl.urls.liveWix = withWixUrl.liveWix.currentUrl;
  assert.ok(validateRecord(withWixUrl).some((error) => error.includes("Wix") || error.includes("URL")));

  const granted = committedRecord();
  granted.approvals.release = { status: "granted", evidence: "assumed" };
  assert.ok(validateRecord(granted).some((error) => error.includes("release")));

  const confirmed = committedRecord();
  confirmed.booking.mode = "API";
  confirmed.booking.impliesAppointmentConfirmed = true;
  confirmed.booking.wording = "appointment-confirmed";
  assert.ok(validateRecord(confirmed).some((error) => error.includes("booking")));

  const migrated = committedRecord();
  migrated.buildPath = "wix-migration";
  migrated.liveWix.changePermitted = true;
  migrated.liveWix.migrationTicketAdded = true;
  assert.ok(validateRecord(migrated).some((error) => error.includes("new-build") || error.includes("Wix")));

  const clinicalField = committedRecord();
  clinicalField.forms[1].fields = ["name", "email", "symptoms"];
  assert.ok(validateRecord(clinicalField).some((error) => error.includes("appointment-enquiry")));

  const schema = committedRecord();
  schema.schemaChange = true;
  schema.secretsIntroduced = true;
  schema.providerConnection = true;
  schema.paidServiceIntroduced = true;
  const schemaErrors = validateRecord(schema);
  assert.ok(schemaErrors.some((error) => error.includes("schema")));
  assert.ok(schemaErrors.some((error) => error.includes("secrets")));
  assert.ok(schemaErrors.some((error) => error.includes("provider")));
  assert.ok(schemaErrors.some((error) => error.includes("paid")));
});

test("unauthorised: unsigned reader, public visitor, and unassigned operator stay denied", () => {
  const record = committedRecord();
  assert.equal(record.unauthorised.unsignedReaderMayLaunch, false);
  assert.equal(record.unauthorised.publicVisitorMayEditLiveWix, false);
  assert.equal(record.unauthorised.unassignedOperatorMayChangeApprovals, false);
  assert.equal(record.unauthorised.anonymousCallerMayReadFutureLeads, false);

  const launch = committedRecord();
  launch.unauthorised.unsignedReaderMayLaunch = true;
  assert.ok(validateRecord(launch).some((error) => error.includes("unsigned reader")));

  const wixEdit = committedRecord();
  wixEdit.unauthorised.publicVisitorMayEditLiveWix = true;
  assert.ok(validateRecord(wixEdit).some((error) => error.includes("public visitor")));

  const approvals = committedRecord();
  approvals.unauthorised.unassignedOperatorMayChangeApprovals = true;
  assert.ok(validateRecord(approvals).some((error) => error.includes("unassigned operator")));

  const leads = committedRecord();
  leads.unauthorised.anonymousCallerMayReadFutureLeads = true;
  assert.ok(validateRecord(leads).some((error) => error.includes("anonymous caller")));
});

test("failure: missing decision block cannot be read as approval", () => {
  assert.throws(() => extractRecord("# CG-01\nNo record here.\n"), /CG-01 record block is missing/);
});
