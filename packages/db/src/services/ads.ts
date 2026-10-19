import type { Queryable } from "../client";
import { recordAudit } from "./audit";
import { isValidDate } from "./dates";
import { recordTimeline } from "./timeline";

export interface AdsAuditRow {
  id: string;
  client_id: string;
  client_name: string;
  account_reference_id: string | null;
  account_label: string | null;
  title: string;
  period_start: string;
  period_end: string;
  scope: string;
  summary: string | null;
  auditor_user_id: string;
  auditor_name: string;
  status: "open" | "closed";
  closed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  finding_count: number;
  open_finding_count: number;
}

export interface AdsFindingRow {
  id: string;
  audit_id: string;
  client_id: string;
  area: string;
  finding: string;
  severity: string;
  recommendation: string | null;
  status: string;
  created_at: Date;
}

export interface AdsChangeRow {
  id: string;
  client_id: string;
  client_name: string;
  audit_id: string | null;
  audit_title: string | null;
  finding_id: string | null;
  finding_text: string | null;
  scope: string;
  description: string;
  before_value: string | null;
  after_value: string | null;
  reason: string;
  responsible_user_id: string;
  responsible_name: string;
  approval_id: string | null;
  approval_title: string | null;
  implemented_on: string;
  verification_on: string | null;
  verified_by: string | null;
  verified_by_name: string | null;
  outcome_note: string | null;
  created_at: Date;
}

export class AdsRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdsRuleError";
  }
}

const AUDIT_SELECT = `
  select a.*, c.name as client_name, r.label as account_label, u.display_name as auditor_name,
         (select count(*)::int from ads_findings f where f.audit_id = a.id) as finding_count,
         (select count(*)::int from ads_findings f where f.audit_id = a.id and f.status = 'open') as open_finding_count
  from ads_audits a join clients c on c.id = a.client_id join staff_users u on u.id = a.auditor_user_id left join account_references r on r.id = a.account_reference_id`;

export async function listAdsAudits(db: Queryable, f: { clientId?: string; status?: string; limit?: number } = {}): Promise<AdsAuditRow[]> {
  const { rows } = await db.query<AdsAuditRow>(
    `${AUDIT_SELECT} where ($1::uuid is null or a.client_id = $1) and ($2::text is null or a.status = $2) order by a.period_end desc, a.created_at desc limit $3`,
    [f.clientId ?? null, f.status ?? null, f.limit ?? 300],
  );
  return rows;
}

export async function getAdsAudit(db: Queryable, id: string) {
  const { rows } = await db.query<AdsAuditRow>(`${AUDIT_SELECT} where a.id = $1`, [id]);
  const audit = rows[0];
  if (!audit) return null;
  const findings = await db.query<AdsFindingRow>("select * from ads_findings where audit_id = $1 order by case severity when 'high' then 0 when 'medium' then 1 else 2 end, created_at", [id]);
  const changes = await listAdsChanges(db, { auditId: id });
  return { ...audit, findings: findings.rows, changes };
}

export interface AdsAuditInput {
  accountReferenceId: string | null;
  title: string;
  periodStart: string;
  periodEnd: string;
  scope: string;
  summary: string | null;
}

function validateAudit(input: AdsAuditInput): void {
  if (!input.title.trim()) throw new AdsRuleError("Title is required.");
  if (!isValidDate(input.periodStart) || !isValidDate(input.periodEnd)) throw new AdsRuleError("Review period dates must be valid.");
  if (input.periodEnd < input.periodStart) throw new AdsRuleError("The review period must end on or after it starts.");
  if (!input.scope.trim()) throw new AdsRuleError("Say what the audit covers (campaigns, ad groups, keywords).");
}

export async function createAdsAudit(db: Queryable, clientId: string, input: AdsAuditInput, actorUserId: string): Promise<string> {
  validateAudit(input);
  if (input.accountReferenceId) {
    const ok = await db.query("select 1 from account_references where id = $1 and client_id = $2", [input.accountReferenceId, clientId]);
    if (!ok.rows.length) throw new AdsRuleError("The account reference does not belong to this client.");
  }
  const { rows } = await db.query<{ id: string }>(
    "insert into ads_audits (client_id, account_reference_id, title, period_start, period_end, scope, summary, auditor_user_id) values ($1, $2, $3, $4, $5, $6, $7, $8) returning id",
    [clientId, input.accountReferenceId || null, input.title.trim(), input.periodStart, input.periodEnd, input.scope.trim(), input.summary, actorUserId],
  );
  const id = rows[0]!.id;
  await recordAudit(db, { actorType: "staff", actorUserId, action: "ads_audit.create", targetType: "ads_audit", targetId: id, clientId, outcome: "success" });
  await recordTimeline(db, { clientId, eventType: "ads_audit_opened", title: `Google Ads audit opened: ${input.title.trim()}`, summary: `Review period ${input.periodStart} to ${input.periodEnd}`, relatedType: "ads_audit", relatedId: id, actorUserId, dedupeKey: `ads_audit_opened:${id}` });
  return id;
}

export async function updateAdsAudit(db: Queryable, id: string, input: AdsAuditInput, actorUserId: string): Promise<void> {
  validateAudit(input);
  const { rows } = await db.query<{ client_id: string; status: string }>("select client_id, status from ads_audits where id = $1", [id]);
  const a = rows[0];
  if (!a) throw new AdsRuleError("Audit not found.");
  if (a.status === "closed") throw new AdsRuleError("Closed audits cannot be edited.");
  await db.query("update ads_audits set account_reference_id = $2, title = $3, period_start = $4, period_end = $5, scope = $6, summary = $7, updated_at = now() where id = $1", [id, input.accountReferenceId || null, input.title.trim(), input.periodStart, input.periodEnd, input.scope.trim(), input.summary]);
  await recordAudit(db, { actorType: "staff", actorUserId, action: "ads_audit.update", targetType: "ads_audit", targetId: id, clientId: a.client_id, outcome: "success" });
}

export async function closeAdsAudit(db: Queryable, id: string, actorUserId: string): Promise<void> {
  const { rows } = await db.query<{ client_id: string; title: string }>("update ads_audits set status = 'closed', closed_at = now(), updated_at = now() where id = $1 and status = 'open' returning client_id, title", [id]);
  const a = rows[0];
  if (!a) throw new AdsRuleError("Audit not found or already closed.");
  await recordAudit(db, { actorType: "staff", actorUserId, action: "ads_audit.close", targetType: "ads_audit", targetId: id, clientId: a.client_id, outcome: "success" });
  await recordTimeline(db, { clientId: a.client_id, eventType: "ads_audit_closed", title: `Google Ads audit closed: ${a.title}`, relatedType: "ads_audit", relatedId: id, actorUserId, dedupeKey: `ads_audit_closed:${id}` });
}

export async function addAdsFinding(db: Queryable, auditId: string, input: { area: string; finding: string; severity: string; recommendation: string | null }, actorUserId: string): Promise<string> {
  const { rows: audits } = await db.query<{ client_id: string; status: string }>("select client_id, status from ads_audits where id = $1", [auditId]);
  const a = audits[0];
  if (!a) throw new AdsRuleError("Audit not found.");
  if (a.status === "closed") throw new AdsRuleError("Closed audits cannot take new findings.");
  if (!input.finding.trim()) throw new AdsRuleError("Describe the finding.");
  const { rows } = await db.query<{ id: string }>("insert into ads_findings (audit_id, client_id, area, finding, severity, recommendation) values ($1, $2, $3, $4, $5, $6) returning id", [auditId, a.client_id, input.area, input.finding.trim(), input.severity, input.recommendation]);
  await recordAudit(db, { actorType: "staff", actorUserId, action: "ads_finding.add", targetType: "ads_finding", targetId: rows[0]!.id, clientId: a.client_id, outcome: "success", metadata: { severity: input.severity, area: input.area } });
  return rows[0]!.id;
}

export async function setAdsFindingStatus(db: Queryable, findingId: string, status: string, actorUserId: string): Promise<void> {
  const { rows } = await db.query<{ client_id: string }>("update ads_findings set status = $2, updated_at = now() where id = $1 returning client_id", [findingId, status]);
  if (rows[0]) await recordAudit(db, { actorType: "staff", actorUserId, action: "ads_finding.status", targetType: "ads_finding", targetId: findingId, clientId: rows[0].client_id, outcome: "success", metadata: { status } });
}

const CHANGE_SELECT = `
  select ch.*, c.name as client_name, a.title as audit_title, f.finding as finding_text, u.display_name as responsible_name,
         ap.title as approval_title, v.display_name as verified_by_name
  from ads_changes ch join clients c on c.id = ch.client_id join staff_users u on u.id = ch.responsible_user_id
  left join ads_audits a on a.id = ch.audit_id left join ads_findings f on f.id = ch.finding_id
  left join approvals ap on ap.id = ch.approval_id left join staff_users v on v.id = ch.verified_by`;

export async function listAdsChanges(db: Queryable, f: { clientId?: string; auditId?: string; unverifiedOnly?: boolean; limit?: number } = {}): Promise<AdsChangeRow[]> {
  const { rows } = await db.query<AdsChangeRow>(
    `${CHANGE_SELECT} where ($1::uuid is null or ch.client_id = $1) and ($2::uuid is null or ch.audit_id = $2) and (not $3 or ch.verification_on is null)
     order by ch.implemented_on desc, ch.created_at desc limit $4`,
    [f.clientId ?? null, f.auditId ?? null, f.unverifiedOnly ?? false, f.limit ?? 300],
  );
  return rows;
}

export async function getAdsChange(db: Queryable, id: string): Promise<AdsChangeRow | null> {
  const { rows } = await db.query<AdsChangeRow>(`${CHANGE_SELECT} where ch.id = $1`, [id]);
  return rows[0] ?? null;
}

export interface AdsChangeInput {
  auditId: string | null;
  findingId: string | null;
  scope: string;
  description: string;
  beforeValue: string | null;
  afterValue: string | null;
  reason: string;
  responsibleUserId: string;
  approvalId: string | null;
  implementedOn: string;
}

/** Records a change that staff made in the Google Ads account. The platform itself never changes a live account. */
export async function recordAdsChange(db: Queryable, clientId: string, input: AdsChangeInput, actorUserId: string): Promise<string> {
  if (!input.description.trim()) throw new AdsRuleError("Describe the change.");
  if (!input.reason.trim()) throw new AdsRuleError("Give the reason for the change.");
  if (!input.scope.trim()) throw new AdsRuleError("Say where the change was made (campaign, ad group, keyword).");
  if (!isValidDate(input.implementedOn)) throw new AdsRuleError("Implementation date must be a valid date.");
  if (input.auditId) {
    const ok = await db.query("select 1 from ads_audits where id = $1 and client_id = $2", [input.auditId, clientId]);
    if (!ok.rows.length) throw new AdsRuleError("The audit does not belong to this client.");
  }
  if (input.findingId) {
    const ok = await db.query("select 1 from ads_findings where id = $1 and client_id = $2 and ($3::uuid is null or audit_id = $3)", [input.findingId, clientId, input.auditId || null]);
    if (!ok.rows.length) throw new AdsRuleError("The finding does not belong to this client or audit.");
  }
  if (input.approvalId) {
    const ok = await db.query("select 1 from approvals where id = $1 and client_id = $2", [input.approvalId, clientId]);
    if (!ok.rows.length) throw new AdsRuleError("The approval does not belong to this client.");
  }
  const { rows } = await db.query<{ id: string }>(
    `insert into ads_changes (client_id, audit_id, finding_id, scope, description, before_value, after_value, reason, responsible_user_id, approval_id, implemented_on)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
    [clientId, input.auditId || null, input.findingId || null, input.scope.trim(), input.description.trim(), input.beforeValue, input.afterValue, input.reason.trim(), input.responsibleUserId, input.approvalId || null, input.implementedOn],
  );
  const id = rows[0]!.id;
  if (input.findingId) await db.query("update ads_findings set status = 'implemented', updated_at = now() where id = $1 and status = 'open'", [input.findingId]);
  await recordAudit(db, { actorType: "staff", actorUserId, action: "ads_change.record", targetType: "ads_change", targetId: id, clientId, outcome: "success" });
  await recordTimeline(db, { clientId, eventType: "ads_change_recorded", title: `Google Ads change: ${input.description.trim().slice(0, 120)}`, summary: input.reason.trim(), relatedType: "ads_change", relatedId: id, actorUserId, dedupeKey: `ads_change_recorded:${id}`, occurredAt: new Date(`${input.implementedOn}T04:00:00Z`) });
  return id;
}

export async function verifyAdsChange(db: Queryable, changeId: string, input: { verificationOn: string; outcomeNote: string }, actorUserId: string): Promise<void> {
  if (!isValidDate(input.verificationOn)) throw new AdsRuleError("Verification date must be a valid date.");
  if (!input.outcomeNote.trim()) throw new AdsRuleError("Record what was observed after the change.");
  const { rows } = await db.query<{ client_id: string; description: string }>("update ads_changes set verification_on = $2, verified_by = $3, outcome_note = $4, updated_at = now() where id = $1 returning client_id, description", [changeId, input.verificationOn, actorUserId, input.outcomeNote.trim()]);
  const c = rows[0];
  if (!c) throw new AdsRuleError("Change not found.");
  await recordAudit(db, { actorType: "staff", actorUserId, action: "ads_change.verify", targetType: "ads_change", targetId: changeId, clientId: c.client_id, outcome: "success" });
  await recordTimeline(db, { clientId: c.client_id, eventType: "ads_change_verified", title: `Google Ads change verified: ${c.description.slice(0, 100)}`, summary: `Observed afterwards: ${input.outcomeNote.trim()}`, relatedType: "ads_change", relatedId: changeId, actorUserId, dedupeKey: `ads_change_verified:${changeId}:${input.verificationOn}` });
}
