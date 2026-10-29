import { createHash, randomBytes } from "node:crypto";
import type { BlogStatus, PlatformRole } from "@clinic-genie/contracts";
import type { Queryable } from "../client";
import { recordAudit } from "./audit";
import { PermissionDeniedError } from "./auth";
import { recordTimeline } from "./timeline";
import {
  BlogRuleError,
  articlePath,
  assertPublishableBody,
  emptyArticleBody,
  isNativeWebsitePlatform,
  parseArticleBody,
  renderPublishedArticle,
  renderPublishedIndex,
  renderPublishedSitemap,
  slugifyTitle,
  type ArticleBody,
} from "./blog-content";

export { BlogRuleError, articlePath, emptyArticleBody, isNativeWebsitePlatform, parseArticleBody, renderPublishedArticle, renderPublishedIndex, renderPublishedSitemap, slugifyTitle };
export type { ArticleBlock, ArticleBody, RenderedArticle } from "./blog-content";

const PREVIEW_HOURS = 72;

export interface ArticleInput {
  clientId: string;
  websiteId: string;
  title: string;
  slug: string | null;
  category: string;
  authorUserId: string;
  reviewerUserId: string | null;
  seoTitle: string;
  seoDescription: string;
  canonicalPath: string | null;
  indexable: boolean;
  body: ArticleBody;
}

export interface ArticleRow {
  id: string;
  client_id: string;
  client_name: string;
  website_id: string;
  website_name: string;
  website_platform: string;
  title: string;
  slug: string;
  category: string;
  author_user_id: string;
  author_name: string;
  reviewer_user_id: string | null;
  reviewer_name: string | null;
  status: BlogStatus;
  seo_title: string;
  seo_description: string;
  canonical_path: string | null;
  indexable: boolean;
  body: ArticleBody;
  current_version_id: string | null;
  live_version_id: string | null;
  version_number: number | null;
  published_at: Date | null;
  unpublished_at: Date | null;
  updated_at: Date;
  native: boolean;
}

export interface ArticleVersionRow {
  id: string;
  version_number: number;
  title: string;
  created_at: Date;
  created_by_name: string;
}

export interface ArticleApprovalRow {
  id: string;
  decision: "approved" | "returned";
  note: string | null;
  decided_at: Date;
  reviewer_name: string;
  version_number: number;
}

export interface ArticleMediaRow {
  id: string;
  alt_text: string;
  content_type: string;
  byte_size: number;
  storage_key: string;
}

const ARTICLE_SELECT = `
  select a.*, c.name as client_name, w.name as website_name, w.platform as website_platform,
         author.display_name as author_name, reviewer.display_name as reviewer_name,
         v.version_number
  from blog_articles a
  join clients c on c.id = a.client_id
  join websites w on w.id = a.website_id
  join staff_users author on author.id = a.author_user_id
  left join staff_users reviewer on reviewer.id = a.reviewer_user_id
  left join blog_article_versions v on v.id = a.current_version_id
`;

function mapArticle(row: ArticleRow & { body: unknown }): ArticleRow {
  return { ...row, body: parseArticleBody(row.body), native: isNativeWebsitePlatform(row.website_platform) };
}

export async function listBlogWebsites(db: Queryable): Promise<Array<{ id: string; name: string; platform: string; client_id: string; client_name: string }>> {
  const { rows } = await db.query(
    `select w.id, w.name, w.platform, w.client_id, c.name as client_name
     from websites w join clients c on c.id = w.client_id
     where w.status = 'active' order by c.name, w.name`,
  );
  return rows;
}

export async function listArticles(db: Queryable, opts: { clientId?: string; websiteId?: string; status?: BlogStatus; category?: string; authorUserId?: string; reviewerUserId?: string; query?: string } = {}): Promise<ArticleRow[]> {
  const { rows } = await db.query<ArticleRow>(
    `${ARTICLE_SELECT}
     where ($1::uuid is null or a.client_id = $1)
       and ($2::uuid is null or a.website_id = $2)
       and ($3::text is null or a.status = $3)
       and ($4::text is null or a.category = $4)
       and ($5::uuid is null or a.author_user_id = $5)
       and ($6::uuid is null or a.reviewer_user_id = $6)
       and ($7::text is null or a.title ilike '%' || $7 || '%' or a.slug ilike '%' || $7 || '%')
     order by a.updated_at desc
     limit 200`,
    [opts.clientId ?? null, opts.websiteId ?? null, opts.status ?? null, opts.category ?? null, opts.authorUserId ?? null, opts.reviewerUserId ?? null, opts.query?.trim() || null],
  );
  return rows.map((row) => mapArticle(row));
}

export async function getArticle(db: Queryable, id: string): Promise<ArticleRow | null> {
  const { rows } = await db.query<ArticleRow>(`${ARTICLE_SELECT} where a.id = $1`, [id]);
  return rows[0] ? mapArticle(rows[0]) : null;
}

export async function listArticleVersions(db: Queryable, articleId: string): Promise<ArticleVersionRow[]> {
  const { rows } = await db.query<ArticleVersionRow>(
    `select v.id, v.version_number, v.title, v.created_at, u.display_name as created_by_name
     from blog_article_versions v join staff_users u on u.id = v.created_by
     where v.article_id = $1 order by v.version_number desc`,
    [articleId],
  );
  return rows;
}

export async function listArticleApprovals(db: Queryable, articleId: string): Promise<ArticleApprovalRow[]> {
  const { rows } = await db.query<ArticleApprovalRow>(
    `select a.id, a.decision, a.note, a.decided_at, u.display_name as reviewer_name, v.version_number
     from blog_approvals a
     join staff_users u on u.id = a.reviewer_user_id
     join blog_article_versions v on v.id = a.version_id
     where a.article_id = $1 order by a.decided_at desc`,
    [articleId],
  );
  return rows;
}

export async function listArticleMedia(db: Queryable, articleId: string): Promise<ArticleMediaRow[]> {
  const { rows } = await db.query<ArticleMediaRow>(
    "select id, alt_text, content_type, byte_size, storage_key from blog_media where article_id = $1 order by created_at",
    [articleId],
  );
  return rows;
}

async function websiteFor(db: Queryable, clientId: string, websiteId: string): Promise<{ platform: string }> {
  const { rows } = await db.query<{ platform: string }>("select platform from websites where id = $1 and client_id = $2 and status = 'active'", [websiteId, clientId]);
  const site = rows[0];
  if (!site) throw new BlogRuleError("Choose an active website for this client.", "websiteId");
  return site;
}

function cleanInput(input: ArticleInput): ArticleInput & { slug: string; body: ArticleBody } {
  const title = input.title.trim();
  const category = input.category.trim();
  const seoTitle = input.seoTitle.trim();
  const seoDescription = input.seoDescription.trim();
  if (!title || title.length > 200) throw new BlogRuleError("Enter a title of 200 characters or fewer.", "title");
  if (!category || category.length > 80) throw new BlogRuleError("Enter a category of 80 characters or fewer.", "category");
  if (!seoTitle || seoTitle.length > 200) throw new BlogRuleError("Enter an SEO title of 200 characters or fewer.", "seoTitle");
  if (!seoDescription || seoDescription.length > 320) throw new BlogRuleError("Enter an SEO description of 320 characters or fewer.", "seoDescription");
  const slug = slugifyTitle(input.slug?.trim() || title);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new BlogRuleError("Use a slug made of lowercase letters, numbers and hyphens.", "slug");
  const canonical = input.canonicalPath?.trim() || null;
  if (canonical && (!canonical.startsWith("/") || canonical.startsWith("//") || canonical.length > 300)) {
    throw new BlogRuleError("Canonical path must start with a single /.", "canonicalPath");
  }
  const body = parseArticleBody(input.body);
  return { ...input, title, category, seoTitle, seoDescription, slug, canonicalPath: canonical, body };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}

async function insertVersion(db: Queryable, articleId: string, clientId: string, input: ReturnType<typeof cleanInput>, actorUserId: string): Promise<string> {
  const next = await db.query<{ n: number }>("select coalesce(max(version_number), 0)::int + 1 as n from blog_article_versions where article_id = $1", [articleId]);
  const { rows } = await db.query<{ id: string }>(
    `insert into blog_article_versions
      (article_id, client_id, version_number, title, slug, category, body, seo_title, seo_description, canonical_path, indexable, created_by)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12) returning id`,
    [articleId, clientId, next.rows[0]!.n, input.title, input.slug, input.category, JSON.stringify(input.body), input.seoTitle, input.seoDescription, input.canonicalPath, input.indexable, actorUserId],
  );
  return rows[0]!.id;
}

export async function createArticle(db: Queryable, input: ArticleInput, actorUserId: string): Promise<string> {
  const clean = cleanInput(input);
  await websiteFor(db, clean.clientId, clean.websiteId);
  let rows: { id: string }[];
  try {
    const inserted = await db.query<{ id: string }>(
      `insert into blog_articles
        (client_id, website_id, title, slug, category, author_user_id, reviewer_user_id, status, seo_title, seo_description, canonical_path, indexable, body, created_by, updated_by)
       values ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9, $10, $11, $12::jsonb, $13, $13) returning id`,
      [clean.clientId, clean.websiteId, clean.title, clean.slug, clean.category, clean.authorUserId, clean.reviewerUserId, clean.seoTitle, clean.seoDescription, clean.canonicalPath, clean.indexable, JSON.stringify(clean.body), actorUserId],
    );
    rows = inserted.rows;
  } catch (error) {
    if (isUniqueViolation(error)) throw new BlogRuleError("That slug is already used on this website.", "slug");
    throw error;
  }
  const id = rows[0]!.id;
  const versionId = await insertVersion(db, id, clean.clientId, clean, actorUserId);
  const { rowCount } = await db.query("update blog_articles set current_version_id = $2 where id = $1", [id, versionId]);
  if (!rowCount) throw new BlogRuleError("Article was not saved.");
  await recordAudit(db, { actorType: "staff", actorUserId, action: "blog.create", targetType: "blog_article", targetId: id, clientId: clean.clientId, outcome: "success", metadata: { status: "draft" } });
  return id;
}

export async function updateArticle(db: Queryable, id: string, input: ArticleInput, actorUserId: string, expectedVersionId: string): Promise<void> {
  const current = await getArticle(db, id);
  if (!current) throw new BlogRuleError("Article not found.");
  if (current.status === "archived") throw new BlogRuleError("Archived articles cannot be edited.");
  if (!expectedVersionId || current.current_version_id !== expectedVersionId) {
    throw new BlogRuleError("A newer version was saved. Reload this article before saving.", "expectedVersionId");
  }
  const clean = cleanInput({ ...input, clientId: current.client_id });
  await websiteFor(db, current.client_id, clean.websiteId);
  if (current.status !== "draft" && current.status !== "published") {
    assertPublishableBody(clean.body, new Set((await listArticleMedia(db, id)).map((media) => media.id)));
  }
  const versionId = await insertVersion(db, id, current.client_id, clean, actorUserId);
  let rowCount = 0;
  try {
    const updated = await db.query(
      `update blog_articles set website_id = $2, title = $3, slug = $4, category = $5, author_user_id = $6, reviewer_user_id = $7,
        seo_title = $8, seo_description = $9, canonical_path = $10, indexable = $11, body = $12::jsonb, current_version_id = $13,
        status = 'draft', updated_by = $14, updated_at = now()
       where id = $1 and current_version_id = $15`,
      [id, clean.websiteId, clean.title, clean.slug, clean.category, clean.authorUserId, clean.reviewerUserId, clean.seoTitle, clean.seoDescription, clean.canonicalPath, clean.indexable, JSON.stringify(clean.body), versionId, actorUserId, expectedVersionId],
    );
    rowCount = updated.rowCount ?? 0;
  } catch (error) {
    if (isUniqueViolation(error)) throw new BlogRuleError("That slug is already used on this website.", "slug");
    throw error;
  }
  if (!rowCount) throw new BlogRuleError("A newer version was saved. Reload this article before saving.", "expectedVersionId");
  await recordAudit(db, { actorType: "staff", actorUserId, action: "blog.update", targetType: "blog_article", targetId: id, clientId: current.client_id, outcome: "success", metadata: { status: "draft", versionId } });
}

async function requireArticle(db: Queryable, id: string): Promise<ArticleRow> {
  const article = await getArticle(db, id);
  if (!article) throw new BlogRuleError("Article not found.");
  return article;
}

async function actorRole(db: Queryable, actorUserId: string): Promise<PlatformRole> {
  const { rows } = await db.query<{ platform_role: PlatformRole }>("select platform_role from staff_users where id = $1 and active", [actorUserId]);
  const role = rows[0]?.platform_role;
  if (!role) throw new PermissionDeniedError();
  return role;
}

export async function submitArticleForReview(db: Queryable, id: string, actorUserId: string): Promise<void> {
  const article = await requireArticle(db, id);
  if (article.status !== "draft") throw new BlogRuleError("Only a draft can be submitted for review.");
  if (!article.reviewer_user_id) throw new BlogRuleError("Choose a reviewer before submitting.", "reviewerUserId");
  assertPublishableBody(article.body, new Set((await listArticleMedia(db, id)).map((media) => media.id)));
  const { rowCount } = await db.query("update blog_articles set status = 'in_review', updated_by = $2, updated_at = now() where id = $1 and status = 'draft'", [id, actorUserId]);
  if (!rowCount) throw new BlogRuleError("Article was not submitted.");
  await recordTimeline(db, { clientId: article.client_id, eventType: "article_submitted", title: `Submitted “${article.title}” for review`, summary: articlePath(article.slug), relatedType: "blog_article", relatedId: id, actorUserId, dedupeKey: `blog-submit:${article.current_version_id}` });
  await recordAudit(db, { actorType: "staff", actorUserId, action: "blog.submit_review", targetType: "blog_article", targetId: id, clientId: article.client_id, outcome: "success", metadata: { versionId: article.current_version_id } });
}

export async function decideArticleReview(db: Queryable, id: string, decision: "approved" | "returned", note: string | null, actorUserId: string): Promise<void> {
  const role = await actorRole(db, actorUserId);
  // D14 lets admin, manager and reviewer approve. It does not add a separate ban on approving an article the same person authored. Specialists cannot approve.
  if (role !== "admin" && role !== "manager" && role !== "reviewer") throw new PermissionDeniedError("You cannot review this article.");
  const article = await requireArticle(db, id);
  if (article.status !== "in_review" || !article.current_version_id) throw new BlogRuleError("This article is not in review.");
  await db.query(
    `insert into blog_approvals (article_id, client_id, version_id, reviewer_user_id, decision, note)
     values ($1, $2, $3, $4, $5, $6)`,
    [id, article.client_id, article.current_version_id, actorUserId, decision, note?.trim() || null],
  );
  const status = decision === "approved" ? "approved" : "draft";
  const { rowCount } = await db.query("update blog_articles set status = $2, updated_by = $3, updated_at = now() where id = $1 and status = 'in_review'", [id, status, actorUserId]);
  if (!rowCount) throw new BlogRuleError("Review was not recorded.");
  await recordTimeline(db, {
    clientId: article.client_id,
    eventType: decision === "approved" ? "article_approved" : "article_returned",
    title: decision === "approved" ? `Approved “${article.title}”` : `Returned “${article.title}” to draft`,
    summary: articlePath(article.slug),
    relatedType: "blog_article",
    relatedId: id,
    actorUserId,
    dedupeKey: decision === "approved" ? `blog-approve:${article.current_version_id}` : `blog-return:${article.current_version_id}`,
  });
  await recordAudit(db, { actorType: "staff", actorUserId, action: decision === "approved" ? "blog.approve" : "blog.return", targetType: "blog_article", targetId: id, clientId: article.client_id, outcome: "success", metadata: { versionId: article.current_version_id } });
}

export async function publishArticle(db: Queryable, id: string, actorUserId: string): Promise<void> {
  const role = await actorRole(db, actorUserId);
  if (role !== "admin" && role !== "manager") throw new PermissionDeniedError("Only an admin or manager can publish.");
  const article = await requireArticle(db, id);
  if (!article.native) throw new BlogRuleError("Publishing is not available for this website. Native websites can be published from Genie Works. Wix Blog publishing is not available.");
  if (article.status !== "approved" || !article.current_version_id) throw new BlogRuleError("Approve the current version before publishing.");
  const { rowCount } = await db.query(
    "update blog_articles set status = 'published', live_version_id = current_version_id, published_at = now(), unpublished_at = null, updated_by = $2, updated_at = now() where id = $1 and status = 'approved'",
    [id, actorUserId],
  );
  if (!rowCount) throw new BlogRuleError("Article was not published.");
  const { rows: publication } = await db.query<{ id: string }>(
    `insert into blog_publications (article_id, client_id, website_id, version_id, action, actor_user_id)
     values ($1, $2, $3, $4, 'publish', $5) returning id`,
    [id, article.client_id, article.website_id, article.current_version_id, actorUserId],
  );
  await recordTimeline(db, { clientId: article.client_id, eventType: "article_published", title: `Published “${article.title}”`, summary: articlePath(article.slug), relatedType: "blog_article", relatedId: id, actorUserId, dedupeKey: `blog-publish:${publication[0]!.id}` });
  await recordAudit(db, { actorType: "staff", actorUserId, action: "blog.publish", targetType: "blog_article", targetId: id, clientId: article.client_id, outcome: "success", metadata: { path: articlePath(article.slug), versionId: article.current_version_id } });
}

export async function unpublishArticle(db: Queryable, id: string, actorUserId: string): Promise<void> {
  const role = await actorRole(db, actorUserId);
  if (role !== "admin" && role !== "manager") throw new PermissionDeniedError("Only an admin or manager can unpublish.");
  const article = await requireArticle(db, id);
  if (!article.live_version_id) throw new BlogRuleError("This article is not published.");
  const { rows: liveRows } = await db.query<{ title: string; slug: string }>("select title, slug from blog_article_versions where id = $1", [article.live_version_id]);
  const live = liveRows[0];
  if (!live) throw new BlogRuleError("This article is not published.");
  const nextStatus = article.status === "published" ? "approved" : article.status;
  const { rowCount } = await db.query(
    "update blog_articles set status = $3, live_version_id = null, unpublished_at = now(), updated_by = $2, updated_at = now() where id = $1 and live_version_id is not null",
    [id, actorUserId, nextStatus],
  );
  if (!rowCount) throw new BlogRuleError("Article was not unpublished.");
  const { rows: publication } = await db.query<{ id: string }>(
    `insert into blog_publications (article_id, client_id, website_id, version_id, action, actor_user_id)
     values ($1, $2, $3, $4, 'unpublish', $5) returning id`,
    [id, article.client_id, article.website_id, article.live_version_id, actorUserId],
  );
  await recordTimeline(db, { clientId: article.client_id, eventType: "article_unpublished", title: `Unpublished “${live.title}”`, summary: articlePath(live.slug), relatedType: "blog_article", relatedId: id, actorUserId, dedupeKey: `blog-unpublish:${publication[0]!.id}` });
  await recordAudit(db, { actorType: "staff", actorUserId, action: "blog.unpublish", targetType: "blog_article", targetId: id, clientId: article.client_id, outcome: "success", metadata: { path: articlePath(live.slug), versionId: article.live_version_id } });
}

export async function archiveArticle(db: Queryable, id: string, actorUserId: string): Promise<void> {
  const article = await requireArticle(db, id);
  if (article.live_version_id) throw new BlogRuleError("Unpublish the article before archiving it.");
  if (article.status === "archived") return;
  const { rowCount } = await db.query("update blog_articles set status = 'archived', updated_by = $2, updated_at = now() where id = $1 and status <> 'published'", [id, actorUserId]);
  if (!rowCount) throw new BlogRuleError("Article was not archived.");
  await recordAudit(db, { actorType: "staff", actorUserId, action: "blog.archive", targetType: "blog_article", targetId: id, clientId: article.client_id, outcome: "success" });
}

export async function addArticleMedia(db: Queryable, articleId: string, input: { storageKey: string; altText: string; contentType: string; byteSize: number }, actorUserId: string): Promise<string> {
  const article = await requireArticle(db, articleId);
  if (article.status === "archived") throw new BlogRuleError("Archived articles cannot take new images.");
  const alt = input.altText.trim();
  if (!alt || alt.length > 300) throw new BlogRuleError("Enter alt text of 300 characters or fewer.", "altText");
  if (!["image/png", "image/jpeg", "image/webp"].includes(input.contentType)) throw new BlogRuleError("Use a PNG, JPEG or WebP image.", "file");
  if (input.byteSize < 1 || input.byteSize > 1_000_000) throw new BlogRuleError("Images must be 1 MB or smaller.", "file");
  const { rows } = await db.query<{ id: string }>(
    `insert into blog_media (article_id, client_id, storage_key, alt_text, content_type, byte_size, created_by)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [articleId, article.client_id, input.storageKey, alt, input.contentType, input.byteSize, actorUserId],
  );
  return rows[0]!.id;
}

export async function getArticleMediaFile(db: Queryable, mediaId: string): Promise<(ArticleMediaRow & { client_id: string }) | null> {
  const { rows } = await db.query<ArticleMediaRow & { client_id: string }>(
    "select id, alt_text, content_type, byte_size, storage_key, client_id from blog_media where id = $1",
    [mediaId],
  );
  return rows[0] ?? null;
}

export async function issueArticlePreview(db: Queryable, articleId: string, actorUserId: string): Promise<{ token: string; expiresAt: Date }> {
  const article = await requireArticle(db, articleId);
  if (!article.current_version_id) throw new BlogRuleError("Save the article before creating a preview.");
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + PREVIEW_HOURS * 60 * 60 * 1000);
  await db.query(
    "insert into blog_preview_tokens (article_id, client_id, version_id, token_hash, expires_at, created_by) values ($1, $2, $3, $4, $5, $6)",
    [articleId, article.client_id, article.current_version_id, tokenHash, expiresAt, actorUserId],
  );
  return { token, expiresAt };
}

export async function revokeArticlePreviews(db: Queryable, articleId: string, actorUserId: string): Promise<void> {
  const article = await requireArticle(db, articleId);
  const { rowCount } = await db.query(
    "update blog_preview_tokens set revoked_at = now() where article_id = $1 and revoked_at is null and expires_at > now()",
    [articleId],
  );
  if (!rowCount) throw new BlogRuleError("There is no active preview link.");
  await recordAudit(db, { actorType: "staff", actorUserId, action: "blog.preview_revoke", targetType: "blog_article", targetId: articleId, clientId: article.client_id, outcome: "success" });
}

export async function getArticlePreview(db: Queryable, token: string): Promise<ArticleRow | null> {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { rows } = await db.query<{ article_id: string; version_id: string | null }>(
    "select article_id, version_id from blog_preview_tokens where token_hash = $1 and expires_at > now() and revoked_at is null",
    [tokenHash],
  );
  const match = rows[0];
  if (!match) return null;
  const article = await getArticle(db, match.article_id);
  if (!article || !match.version_id || match.version_id === article.current_version_id) return article;
  const { rows: versions } = await db.query<{ title: string; slug: string; category: string; body: unknown; seo_title: string; seo_description: string; canonical_path: string | null; indexable: boolean; version_number: number }>(
    `select title, slug, category, body, seo_title, seo_description, canonical_path, indexable, version_number
     from blog_article_versions where id = $1 and article_id = $2`,
    [match.version_id, article.id],
  );
  const version = versions[0];
  if (!version) return null;
  return {
    ...article,
    title: version.title,
    slug: version.slug,
    category: version.category,
    body: parseArticleBody(version.body),
    seo_title: version.seo_title,
    seo_description: version.seo_description,
    canonical_path: version.canonical_path,
    indexable: version.indexable,
    current_version_id: match.version_id,
    version_number: version.version_number,
  };
}

export interface PublishedBlogArticle {
  id: string;
  path: string;
  slug: string;
  title: string;
  category: string;
  seoTitle: string;
  seoDescription: string;
  canonicalPath: string | null;
  indexable: boolean;
  publishedAt: string;
  updatedAt: string;
  body: ArticleBody;
  media: Array<{ id: string; alt: string; contentType: string }>;
}

export interface PublishedBlog {
  layout: "clinic-article-v1";
  origin: string | null;
  articles: PublishedBlogArticle[];
  sitemap: Array<{ path: string; lastModified: string }>;
}

interface LiveArticleRow {
  id: string;
  published_at: Date | null;
  title: string;
  slug: string;
  category: string;
  body: unknown;
  seo_title: string;
  seo_description: string;
  canonical_path: string | null;
  indexable: boolean;
  revised_at: Date;
  website_url: string | null;
}

function websiteOrigin(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export async function getPublishedBlog(db: Queryable, websiteId: string, token: string): Promise<PublishedBlog | null> {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { rows: authorised } = await db.query("select 1 from seo_site_tokens where website_id = $1 and token_hash = $2 and revoked_at is null", [websiteId, tokenHash]);
  if (!authorised.length) return null;
  const { rows: sites } = await db.query<{ url: string | null }>("select url from websites where id = $1", [websiteId]);
  const { rows } = await db.query<LiveArticleRow>("select * from published_blog_articles($1, $2)", [websiteId, tokenHash]);
  const articles: PublishedBlogArticle[] = [];
  for (const row of rows) {
    const body = parseArticleBody(row.body);
    const used = body.blocks.flatMap((block) => block.type === "image" ? [block.mediaId] : []);
    const media = [];
    for (const mediaId of used) {
      const item = await getPublishedBlogMedia(db, websiteId, mediaId, token);
      if (item) media.push(item);
    }
    const revisedAt = new Date(row.revised_at).toISOString();
    articles.push({
      id: row.id,
      path: articlePath(row.slug),
      slug: row.slug,
      title: row.title,
      category: row.category,
      seoTitle: row.seo_title,
      seoDescription: row.seo_description,
      canonicalPath: row.canonical_path,
      indexable: row.indexable,
      publishedAt: new Date(row.published_at ?? row.revised_at).toISOString(),
      updatedAt: revisedAt,
      body,
      media: media.map((item) => ({ id: item.id, alt: item.alt_text, contentType: item.content_type })),
    });
  }
  return {
    layout: "clinic-article-v1",
    origin: websiteOrigin(sites[0]?.url ?? rows[0]?.website_url ?? null),
    articles,
    sitemap: articles.filter((article) => article.indexable).map((article) => ({ path: article.path, lastModified: article.updatedAt })),
  };
}

export async function getPublishedBlogMedia(db: Queryable, websiteId: string, mediaId: string, token: string): Promise<ArticleMediaRow | null> {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { rows: authorised } = await db.query("select 1 from seo_site_tokens where website_id = $1 and token_hash = $2 and revoked_at is null", [websiteId, tokenHash]);
  if (!authorised.length) return null;
  const { rows } = await db.query<ArticleMediaRow & { body: unknown }>(
    "select * from published_blog_media($1, $2, $3)",
    [websiteId, mediaId, tokenHash],
  );
  const media = rows[0];
  if (!media) return null;
  const used = parseArticleBody(media.body).blocks.some((block) => block.type === "image" && block.mediaId === media.id);
  if (!used) return null;
  return { id: media.id, alt_text: media.alt_text, content_type: media.content_type, byte_size: media.byte_size, storage_key: media.storage_key };
}
