/**
 * Checks the DAY-01 scope sheet.
 * Provider access and the security reviewer stay unconfirmed until evidence exists.
 */

const REQUIRED_PHRASES = [
  "Product name: Genie Works",
  "Build path: new build",
  "Live Wix stays unchanged",
  "Booking method: ENQUIRY",
  "Security reviewer: not booked",
  "No provider access is confirmed",
];

const ACCESS = {
  githubRepository: "exists-admin-not-confirmed",
  vercel: "not-confirmed",
  database: "not-confirmed",
  auth: "not-confirmed",
  email: "not-confirmed",
  bookingProvider: "not-used-enquiry-only",
  ga4: "not-confirmed",
  gsc: "not-confirmed",
};

const PLACEHOLDER_NAMES = new Set([
  "tbd",
  "unknown",
  "n/a",
  "na",
  "independent reviewer",
  "security reviewer",
  "reviewer",
]);

export function extractRecord(markdown) {
  const match = markdown.match(/```day01\n([\s\S]*?)\n```/);
  if (!match) {
    throw new Error("DAY-01 record block is missing");
  }
  return JSON.parse(match[1]);
}

function reviewerErrors(reviewer) {
  if (!reviewer || reviewer.status !== "not-booked") {
    const name = typeof reviewer?.name === "string" ? reviewer.name.trim() : "";
    if (reviewer?.status !== "booked") {
      return ["security reviewer status is invalid"];
    }
    if (!name || PLACEHOLDER_NAMES.has(name.toLowerCase())) {
      return ["a booked reviewer needs a real name"];
    }
    if (reviewer.independent !== true || !reviewer.bookedFor || !reviewer.evidence) {
      return ["a booked reviewer needs independence, a date, and evidence"];
    }
    return [];
  }
  if (
    reviewer.name !== null ||
    reviewer.independent !== null ||
    reviewer.bookedFor !== null ||
    reviewer.evidence !== null
  ) {
    return ["an unbooked reviewer must not carry a name or date"];
  }
  return [];
}

export function validateRecord(record, markdown = "") {
  const errors = [];
  if (!record || typeof record !== "object") return ["record must be an object"];

  if (markdown) {
    for (const phrase of REQUIRED_PHRASES) {
      if (!markdown.includes(phrase)) errors.push(`missing required phrase: ${phrase}`);
    }
  }

  if (record.task !== "DAY-01" || record.covers?.join() !== "CG-01,CG-02") {
    errors.push("task must cover CG-01 and CG-02");
  }
  if (record.status !== "scope-frozen-reviewer-not-booked" && record.securityReviewer?.status !== "booked") {
    errors.push("status must stay frozen until a reviewer is actually booked");
  }

  const scope = record.scopeSheet ?? {};
  if (scope.productName !== "Genie Works") {
    errors.push("product name must be Genie Works");
  }
  if (
    scope.source !== "decisions/CG-01-pilot-scope.md" ||
    scope.pilotWebsiteId !== "demo-clinic-a" ||
    scope.buildPath !== "new-build" ||
    scope.liveWixChangePermitted !== false ||
    scope.bookingMode !== "ENQUIRY" ||
    scope.pageCount !== 7 ||
    scope.productionUrl !== null ||
    scope.stagingUrl !== null ||
    scope.liveWixUrl !== null ||
    scope.approvalsGranted !== false
  ) {
    errors.push("scope sheet must match the frozen CG-01 pilot");
  }

  const audit = record.codeAudit ?? {};
  if (
    audit.applicationCode !== false ||
    audit.frameworkSelected !== false ||
    audit.packageManifest !== false ||
    audit.wixProjectPresent !== false ||
    audit.envFilePresent !== false ||
    audit.ciWorkflowPresent !== false ||
    audit.stagingDeployExists !== false ||
    audit.specFileCount !== 21
  ) {
    errors.push("code audit no longer matches the inspected repository");
  }

  const rules = record.branchRules ?? {};
  if (
    rules.workOnFeatureBranches !== true ||
    rules.protectMainFromForcePush !== true ||
    rules.commitSecrets !== false ||
    rules.deployFromThisTask !== false
  ) {
    errors.push("branch rules were weakened");
  }

  const deploy = record.deployApproach ?? {};
  if (
    deploy.hostConnected !== false ||
    deploy.host !== null ||
    deploy.stagingUrl !== null ||
    deploy.productionUrl !== null ||
    deploy.recovery !== "git-revert-docs-only"
  ) {
    errors.push("deploy approach must stay unconnected");
  }

  for (const [key, expected] of Object.entries(ACCESS)) {
    if (record.access?.[key] !== expected) {
      errors.push(`${key} access must stay ${expected}`);
    }
  }

  errors.push(...reviewerErrors(record.securityReviewer));

  const access = record.unauthorised ?? {};
  if (access.unsignedReaderMayBookReviewer !== false) {
    errors.push("an unsigned reader must not book the reviewer");
  }
  if (access.unsignedReaderMayConnectProvider !== false) {
    errors.push("an unsigned reader must not connect a provider");
  }
  if (access.publicVisitorMayEditLiveWix !== false) {
    errors.push("a public visitor must not edit live Wix");
  }
  if (access.unassignedOperatorMayMarkStagingLive !== false) {
    errors.push("an unassigned operator must not mark staging live");
  }

  if (record.schemaChange !== false) errors.push("schema change is outside DAY-01");
  if (record.secretsIntroduced !== false) errors.push("secrets are outside DAY-01");
  if (record.providerConnection !== false) errors.push("provider connection is outside DAY-01");
  if (record.paidServiceIntroduced !== false) errors.push("paid service is outside DAY-01");

  return errors;
}
