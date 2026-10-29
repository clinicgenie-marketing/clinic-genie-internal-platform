import { BLOG_LAYOUT } from "@clinic-genie/contracts";

export const BLOG_LAYOUT_ID = BLOG_LAYOUT;

export class BlogRuleError extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "BlogRuleError";
    this.field = field;
  }
}

export type ArticleBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "link"; href: string; text: string }
  | { type: "image"; mediaId: string; alt: string };

export interface ArticleBody {
  layout: typeof BLOG_LAYOUT;
  blocks: ArticleBlock[];
}

/** Native clinic sites are Next.js deployments. Wix is never treated as native. */
export function isNativeWebsitePlatform(platform: string): boolean {
  const value = platform.trim().toLowerCase();
  if (!value || value.includes("wix")) return false;
  return value.includes("next.js") || value.includes("nextjs") || value.includes("vercel");
}

export function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "article";
}

export function articlePath(slug: string): string {
  return `/blog/${slug}`;
}

export function emptyArticleBody(): ArticleBody {
  return { layout: BLOG_LAYOUT, blocks: [{ type: "paragraph", text: "" }] };
}

export function parseArticleBody(value: unknown): ArticleBody {
  if (!value || typeof value !== "object") throw new BlogRuleError("Article content is missing.", "body");
  const body = value as { layout?: unknown; blocks?: unknown };
  if (body.layout !== BLOG_LAYOUT || !Array.isArray(body.blocks)) throw new BlogRuleError("Article content uses an unknown layout.", "body");
  return { layout: BLOG_LAYOUT, blocks: body.blocks.map(parseBlock) };
}

function parseBlock(value: unknown, index = 0): ArticleBlock {
  if (!value || typeof value !== "object") throw new BlogRuleError("A content block is invalid.", "body");
  const block = value as { type?: unknown; text?: unknown; level?: unknown; href?: unknown; mediaId?: unknown; alt?: unknown };
  if (block.type === "paragraph" || block.type === "heading") {
    const text = stringField(block.text, 4000, "Block text");
    if (block.type === "heading") {
      const level = block.level === 2 || block.level === 3 ? block.level : null;
      if (!level) throw new BlogRuleError("Headings are level 2 or 3.", "body");
      return { type: "heading", level, text };
    }
    return { type: "paragraph", text };
  }
  if (block.type === "link") {
    const href = stringField(block.href, 500, "Link");
    let url: URL;
    try {
      url = new URL(href);
    } catch {
      throw new BlogRuleError("Links must be http or https URLs.", "body");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new BlogRuleError("Links must be http or https URLs.", "body");
    return { type: "link", href: url.toString(), text: stringField(block.text, 300, "Link text") };
  }
  if (block.type === "image") {
    const mediaId = stringField(block.mediaId, 80, "Image");
    if (!/^[0-9a-f-]{36}$/i.test(mediaId)) throw new BlogRuleError("Choose an uploaded image.", "body");
    const alt = stringField(block.alt, 300, "Alt text");
    if (!alt.trim()) throw new BlogRuleError("Every image needs alt text.", "body");
    return { type: "image", mediaId, alt };
  }
  throw new BlogRuleError(`Content block ${index + 1} is not supported.`, "body");
}

function stringField(value: unknown, max: number, label: string): string {
  if (typeof value !== "string") throw new BlogRuleError(`${label} is required.`, "body");
  const text = value.trim();
  if (text.length > max) throw new BlogRuleError(`${label} must be ${max} characters or fewer.`, "body");
  return text;
}

/** Drafts may be incomplete. Submission and publication require readable content and alt text. */
export function assertPublishableBody(body: ArticleBody, mediaIds: Set<string>): void {
  if (body.blocks.length < 1 || body.blocks.length > 80) throw new BlogRuleError("Add between 1 and 80 content blocks.", "body");
  const readable = body.blocks.some((block) => block.type !== "image" && block.text.trim().length > 0);
  if (!readable) throw new BlogRuleError("Add some article text before review.", "body");
  for (const block of body.blocks) {
    if (block.type === "paragraph" || block.type === "heading" || block.type === "link") {
      if (!block.text.trim()) throw new BlogRuleError("Fill in or remove empty blocks before review.", "body");
    }
    if (block.type === "image") {
      if (!block.alt.trim()) throw new BlogRuleError("Every image needs alt text.", "body");
      if (!mediaIds.has(block.mediaId)) throw new BlogRuleError("An image block uses a file that is not on this article.", "body");
    }
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    if (character === "&") return "&amp;";
    if (character === "<") return "&lt;";
    if (character === ">") return "&gt;";
    if (character === '"') return "&quot;";
    return "&#39;";
  });
}

export interface RenderedArticle {
  path: string;
  slug: string;
  title: string;
  category: string;
  seoTitle: string;
  seoDescription: string;
  canonicalPath: string | null;
  indexable: boolean;
  updatedAt: string;
  body: ArticleBody;
}

/** HTML the native site can render from a published revision. Text is escaped. Links stay http or https. */
export function renderPublishedArticle(article: RenderedArticle, origin: string | null, mediaBase: string): string {
  const canonical = article.canonicalPath || article.path;
  const canonicalHref = origin ? new URL(canonical, origin).toString() : canonical;
  const robots = article.indexable ? "index,follow" : "noindex,nofollow";
  const blocks = article.body.blocks.map((block) => {
    if (block.type === "heading") {
      const tag = block.level === 2 ? "h2" : "h3";
      return `<${tag}>${escapeHtml(block.text)}</${tag}>`;
    }
    if (block.type === "link") return `<p><a href="${escapeHtml(block.href)}" rel="noopener noreferrer">${escapeHtml(block.text)}</a></p>`;
    if (block.type === "image") {
      return `<figure><img src="${escapeHtml(`${mediaBase}/${block.mediaId}`)}" alt="${escapeHtml(block.alt)}"></figure>`;
    }
    return `<p>${escapeHtml(block.text)}</p>`;
  }).join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(article.seoTitle)}</title>
<meta name="description" content="${escapeHtml(article.seoDescription)}">
<link rel="canonical" href="${escapeHtml(canonicalHref)}">
<meta name="robots" content="${robots}">
</head>
<body>
<article>
<p>${escapeHtml(article.category)}</p>
<h1>${escapeHtml(article.title)}</h1>
${blocks}
</article>
</body>
</html>`;
}

export function renderPublishedIndex(articles: RenderedArticle[], origin: string | null, pageBase: string): string {
  const items = articles.map((article) => {
    const href = `${pageBase}/${encodeURIComponent(article.slug)}`;
    return `<li><a href="${escapeHtml(href)}">${escapeHtml(article.title)}</a></li>`;
  }).join("\n");
  const canonical = origin ? new URL("/blog", origin).toString() : "/blog";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Blog</title>
<link rel="canonical" href="${escapeHtml(canonical)}">
</head>
<body>
<main>
<h1>Blog</h1>
${items ? `<ul>${items}</ul>` : "<p>No published articles.</p>"}
</main>
</body>
</html>`;
}

/** Sitemap of indexable published paths only. Preview and draft paths are never included. */
export function renderPublishedSitemap(articles: Array<{ path: string; indexable: boolean; updatedAt: string }>, origin: string | null): string {
  const urls = articles.filter((article) => article.indexable).map((article) => {
    const loc = origin ? new URL(article.path, origin).toString() : article.path;
    const lastmod = article.updatedAt.slice(0, 10);
    return `<url><loc>${escapeHtml(loc)}</loc><lastmod>${escapeHtml(lastmod)}</lastmod></url>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}
