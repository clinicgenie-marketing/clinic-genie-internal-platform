import Link from "next/link";
import { notFound } from "next/navigation";
import { canEditClient, canPublishClient, canReviewClient, getArticle, listActiveStaff, listArticleApprovals, listArticleMedia, listArticleVersions, listBlogWebsites } from "@clinic-genie/db";
import type { BlogStatus } from "@clinic-genie/contracts";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { PageHeader, Card, CardHeader } from "@/components/ui/Card";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { updateArticleAction } from "@/app/actions/blog";
import { ArticleForm } from "@/components/modules/blog/ArticleForm";
import { BlogWorkflow } from "@/components/modules/blog/BlogWorkflow";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<BlogStatus, string> = { draft: "Draft", in_review: "In review", approved: "Approved", published: "Published", archived: "Archived" };
const STATUS_TONE: Record<BlogStatus, Tone> = { draft: "neutral", in_review: "warn", approved: "info", published: "good", archived: "neutral" };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Article ${id.slice(0, 8)}` };
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireAccess();
  const data = await staffTx(access, async (db) => {
    const article = await getArticle(db, id);
    if (!article) return null;
    return {
      article,
      versions: await listArticleVersions(db, id),
      approvals: await listArticleApprovals(db, id),
      media: await listArticleMedia(db, id),
      websites: await listBlogWebsites(db),
      staff: await listActiveStaff(db),
    };
  });
  if (!data) notFound();
  const { article } = data;
  const canEdit = canEditClient(access, article.client_id) && article.status !== "archived";
  const live = Boolean(article.live_version_id);
  const reviewers = data.staff.filter((person) => person.platform_role === "admin" || person.platform_role === "manager" || person.platform_role === "reviewer");
  return (
    <>
      <PageHeader
        eyebrow={<Link href="/blog" className="text-action hover:underline">Blog</Link>}
        title={article.title}
        description={`${article.client_name} · ${article.website_name} · ${article.website_platform}`}
        action={<Badge tone={STATUS_TONE[article.status]}>{STATUS_LABEL[article.status]}</Badge>}
      />
      <div className="mb-6">
        <BlogWorkflow
          articleId={article.id}
          status={article.status}
          native={article.native}
          live={live}
          canEdit={canEditClient(access, article.client_id)}
          canReview={canReviewClient(access, article.client_id)}
          canPublish={canPublishClient(access, article.client_id)}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        {live && article.status !== "published" && <div className="mb-4"><Notice tone="neutral">A published revision is still on the website. This working copy is not public.</Notice></div>}
        {article.status === "published" && canEdit && <div className="mb-4"><Notice tone="neutral">Saving starts a new draft. The published page stays as it is until that draft is approved and published.</Notice></div>}
        <Card className="p-5">
          {canEdit ? (
            <ArticleForm
              action={updateArticleAction}
              websites={data.websites}
              people={data.staff}
              reviewers={reviewers}
              media={data.media}
              lockedClientId={article.client_id}
              article={article}
            />
          ) : (
            <p className="text-sm text-muted">This article cannot be edited.</p>
          )}
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Versions" description="Each save keeps the previous version. The website shows the live version until a new revision is published." />
            <ol className="divide-y divide-line">
              {data.versions.map((version) => (
                <li key={version.id} className="px-5 py-3 text-sm">
                  <span className="font-medium">Version {version.version_number}</span>
                  <span className="text-muted"> · {version.title} · {version.created_by_name} · {new Intl.DateTimeFormat("en-SG", { timeZone: "Asia/Singapore", dateStyle: "medium", timeStyle: "short" }).format(new Date(version.created_at))}</span>
                  {version.id === article.current_version_id && <Badge className="ml-2">Working</Badge>}
                  {version.id === article.live_version_id && <Badge tone="good" className="ml-2">Live</Badge>}
                </li>
              ))}
            </ol>
          </Card>
          <Card>
            <CardHeader title="Review record" />
            <ol className="divide-y divide-line">
              {data.approvals.length === 0 && <li className="px-5 py-3 text-sm text-muted">No review decision yet.</li>}
              {data.approvals.map((approval) => (
                <li key={approval.id} className="px-5 py-3 text-sm">
                  <span className="font-medium">{approval.decision === "approved" ? "Approved" : "Returned"}</span>
                  <span className="text-muted"> · version {approval.version_number} · {approval.reviewer_name}</span>
                  {approval.note && <p className="mt-1 text-muted">{approval.note}</p>}
                </li>
              ))}
            </ol>
          </Card>
          <Card>
            <CardHeader title="Images" description="Alt text is required. An image stays private until a published revision includes it." />
            <ul className="divide-y divide-line">
              {data.media.length === 0 && <li className="px-5 py-3 text-sm text-muted">No images uploaded.</li>}
              {data.media.map((item) => (
                <li key={item.id} className="px-5 py-3 text-sm">
                  <a href={`/api/blog-media/${item.id}`} className="text-action hover:underline" target="_blank" rel="noreferrer">{item.alt_text}</a>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
