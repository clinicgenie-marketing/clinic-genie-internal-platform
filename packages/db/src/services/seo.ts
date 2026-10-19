import type { Queryable } from "../client";
import { recordAudit } from "./audit";
import { isValidDate } from "./dates";
import { recordTimeline } from "./timeline";

export interface SeoPageRow {
  id: string;
  client_id: string;
  client_name: string;
  website_id: string | null;
  website_name: string | null;
  page_path: string;
  page_title: string | null;
  primary_keyword: string | null;
  secondary_keywords: string[];
  search_intent: string | null;
  content_status: string;
  owner_user_id: string | null;
  owner_name: string | null;
  last_reviewed_on: string | null;
  next_review_on: string | null;
  mapping_flag: string;
  flag_note: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  archived_at: Date | null;
  change_count: number;
}

export interface SeoChangeRow {
  id: string;
  client_id: string;
  seo_page_id: string;
  page_path: string;
  change_type: string;
  before_value: string | null;
  after_value: string | null;
  reason: string;
  changed_by: string;
  changed_by_name: string;
  changed_on: string;
  approval_id: string | null;
  verification_on: string | null;
  verified_by: string | null;
  verified_by_name: string | null;
  outcome_note: string | null;
  created_at: Date;
}

export class SeoRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeoRuleError";
  }
}

const PAGE_SELECT = `
  select p.*, c.name as client_name, w.name as website_name, u.display_name as owner_name,
         (select count(*)::int from seo_changes s where s.seo_page_id = p.id) as change_count
  from seo_pages p join clients c on c.id = p.client_id left join websites w on w.id = p.website_id left join staff_users u on u.id = p.owner_user_id`;

export async function listSeoPages(db: Queryable, f: { clientId?: string; contentStatus?: string; flaggedOnly?: boolean; includeArchived?: boolean; limit?: number } = {}): Promise<SeoPageRow[]> {
  const { rows } = await db.query<SeoPageRow>(
    `${PAGE_SELECT} where ($1::uuid is null or p.client_id = $1) and ($2::text is null or p.content_status = $2)
       and (not $3 or p.mapping_flag <> 'none') and ($4 or p.archived_at is null)
     order by c.name, p.page_path limit $5`,
    [f.clientId ?? null, f.contentStatus ?? null, f.flaggedOnly ?? false, f.includeArchived ?? false, f.limit ?? 500],
  );
  return rows;
}

export async function getSeoPage(db: Queryable, id: string): Promise<(SeoPageRow & { changes: SeoChangeRow[] }) | null> {
  const { rows } = await db.query<SeoPageRow>(`${PAGE_SELECT} where p.id = $1`, [id]);
  const page = rows[0];
  if (!page) return null;
  const changes = await listSeoChanges(db, { pageId: id });
  return { ...page, changes };
}

export interface SeoPageInput {
  websiteId: string | null;
  pagePath: string;
  pageTitle: string | null;
  primaryKeyword: string | null;
  secondaryKeywords: string[];
  searchIntent: string | null;
  contentStatus: string;
  ownerUserId: string | null;
  lastReviewedOn: string | null;
  nextReviewOn: string | null;
  mappingFlag: string;
  flagNote: string | null;
  notes: string | null;
}

function validatePage(input: SeoPageInput): void {
  if (!input.pagePath.trim()) throw new SeoRuleError("Page path or URL is required.");
  for (const d of [input.lastReviewedOn, input.nextReviewOn]) if (d && !isValidDate(d)) throw new SeoRuleError("Review dates must be valid dates.");
  if (input.mappingFlag !== "none" && !input.flagNote?.trim()) throw new SeoRuleError("Explain the mapping problem in the flag note.");
}

export async function createSeoPage(db: Queryable, clientId: string, input: SeoPageInput, actorUserId: string): Promise<string> {
  validatePage(input);
  const { rows } = await db.query<{ id: string }>(
    `insert into seo_pages (client_id, website_id, page_path, page_title, primary_keyword, secondary_keywords, search_intent, content_status, owner_user_id,
       last_reviewed_on, next_review_on, mapping_flag, flag_note, notes, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) returning id`,
    [clientId, input.websiteId, input.pagePath.trim(), input.pageTitle, input.primaryKeyword, input.secondaryKeywords, input.searchIntent, input.contentStatus, input.ownerUserId, input.lastReviewedOn, input.nextReviewOn, input.mappingFlag, input.flagNote, input.notes, actorUserId],
  );
  await recordAudit(db, { actorType: "staff", actorUserId, action: "seo_page.create", targetType: "seo_page", targetId: rows[0]!.id, clientId, outcome: "success" });
  return rows[0]!.id;
}

export async function updateSeoPage(db: Queryable, id: string, input: SeoPageInput, actorUserId: string): Promise<void> {
  validatePage(input);
  const { rows } = await db.query<{ client_id: string }>(
    `update seo_pages set website_id = $2, page_path = $3, page_title = $4, primary_keyword = $5, secondary_keywords = $6, search_intent = $7, content_status = $8,
       owner_user_id = $9, last_reviewed_on = $10, next_review_on = $11, mapping_flag = $12, flag_note = $13, notes = $14, updated_at = now()
     where id = $1 returning client_id`,
    [id, input.websiteId, input.pagePath.trim(), input.pageTitle, input.primaryKeyword, input.secondaryKeywords, input.searchIntent, input.contentStatus, input.ownerUserId, input.lastReviewedOn, input.nextReviewOn, input.mappingFlag, input.flagNote, input.notes],
  );
  if (rows[0]) await recordAudit(db, { actorType: "staff", actorUserId, action: "seo_page.update", targetType: "seo_page", targetId: id, clientId: rows[0].client_id, outcome: "success", metadata: { mappingFlag: input.mappingFlag, contentStatus: input.contentStatus } });
}

export async function archiveSeoPage(db: Queryable, id: string, actorUserId: string): Promise<void> {
  const { rows } = await db.query<{ client_id: string }>("update seo_pages set archived_at = now(), updated_at = now() where id = $1 and archived_at is null returning client_id", [id]);
  if (rows[0]) await recordAudit(db, { actorType: "staff", actorUserId, action: "seo_page.archive", targetType: "seo_page", targetId: id, clientId: rows[0].client_id, outcome: "success" });
}

export async function listSeoChanges(db: Queryable, f: { clientId?: string; pageId?: string; unverifiedOnly?: boolean; limit?: number } = {}): Promise<SeoChangeRow[]> {
  const { rows } = await db.query<SeoChangeRow>(
    `select s.*, p.page_path, u.display_name as changed_by_name, v.display_name as verified_by_name
     from seo_changes s join seo_pages p on p.id = s.seo_page_id join staff_users u on u.id = s.changed_by left join staff_users v on v.id = s.verified_by
     where ($1::uuid is null or s.client_id = $1) and ($2::uuid is null or s.seo_page_id = $2) and (not $3 or s.verification_on is null)
     order by s.changed_on desc, s.created_at desc limit $4`,
    [f.clientId ?? null, f.pageId ?? null, f.unverifiedOnly ?? false, f.limit ?? 300],
  );
  return rows;
}

export interface SeoChangeInput {
  changeType: string;
  beforeValue: string | null;
  afterValue: string | null;
  reason: string;
  changedOn: string;
  approvalId: string | null;
}

export async function recordSeoChange(db: Queryable, pageId: string, input: SeoChangeInput, actorUserId: string): Promise<string> {
  const { rows: pages } = await db.query<{ client_id: string; page_path: string }>("select client_id, page_path from seo_pages where id = $1", [pageId]);
  const page = pages[0];
  if (!page) throw new SeoRuleError("Page not found.");
  if (!input.reason.trim()) throw new SeoRuleError("Give the reason for the change.");
  if (!isValidDate(input.changedOn)) throw new SeoRuleError("Change date must be a valid date.");
  if (input.approvalId) {
    const ok = await db.query("select 1 from approvals where id = $1 and client_id = $2", [input.approvalId, page.client_id]);
    if (!ok.rows.length) throw new SeoRuleError("The approval does not belong to this client.");
  }
  const { rows } = await db.query<{ id: string }>(
    `insert into seo_changes (client_id, seo_page_id, change_type, before_value, after_value, reason, changed_by, changed_on, approval_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
    [page.client_id, pageId, input.changeType, input.beforeValue, input.afterValue, input.reason.trim(), actorUserId, input.changedOn, input.approvalId || null],
  );
  const id = rows[0]!.id;
  await db.query("update seo_pages set updated_at = now() where id = $1", [pageId]);
  await recordAudit(db, { actorType: "staff", actorUserId, action: "seo_change.record", targetType: "seo_change", targetId: id, clientId: page.client_id, outcome: "success", metadata: { changeType: input.changeType } });
  await recordTimeline(db, { clientId: page.client_id, eventType: "seo_change_recorded", title: `SEO change on ${page.page_path}: ${input.changeType.replace(/_/g, " ")}`, summary: input.reason.trim(), relatedType: "seo_change", relatedId: id, actorUserId, dedupeKey: `seo_change_recorded:${id}`, occurredAt: new Date(`${input.changedOn}T04:00:00Z`) });
  return id;
}

export async function verifySeoChange(db: Queryable, changeId: string, input: { verificationOn: string; outcomeNote: string }, actorUserId: string): Promise<void> {
  if (!isValidDate(input.verificationOn)) throw new SeoRuleError("Verification date must be a valid date.");
  if (!input.outcomeNote.trim()) throw new SeoRuleError("Record what was observed after the change.");
  const { rows } = await db.query<{ client_id: string; page_path: string; change_type: string }>(
    `update seo_changes s set verification_on = $2, verified_by = $3, outcome_note = $4, updated_at = now() from seo_pages p
     where s.id = $1 and p.id = s.seo_page_id returning s.client_id, p.page_path, s.change_type`,
    [changeId, input.verificationOn, actorUserId, input.outcomeNote.trim()],
  );
  const c = rows[0];
  if (!c) throw new SeoRuleError("Change not found.");
  await recordAudit(db, { actorType: "staff", actorUserId, action: "seo_change.verify", targetType: "seo_change", targetId: changeId, clientId: c.client_id, outcome: "success" });
  await recordTimeline(db, { clientId: c.client_id, eventType: "seo_change_verified", title: `SEO change verified on ${c.page_path}`, summary: `Observed afterwards: ${input.outcomeNote.trim()}`, relatedType: "seo_change", relatedId: changeId, actorUserId, dedupeKey: `seo_change_verified:${changeId}:${input.verificationOn}` });
}
