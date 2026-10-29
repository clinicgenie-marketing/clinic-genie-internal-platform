import Link from "next/link";
import { canEditClient, listActiveStaff, listBlogWebsites, listClientsForRequest, scopeWorkspace } from "@clinic-genie/db";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Notice";
import { createArticleAction } from "@/app/actions/blog";
import { ArticleForm } from "@/components/modules/blog/ArticleForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "New article" };

export default async function NewArticlePage({ searchParams }: { searchParams: Promise<{ client?: string; website?: string }> }) {
  const access = await requireAccess();
  const params = await searchParams;
  const data = await staffTx(access, async (db) => {
    const websites = await listBlogWebsites(db);
    const clients = await listClientsForRequest(db, params.client);
    const selection = scopeWorkspace({
      requestedClientId: params.client,
      requestedWebsiteId: params.website,
      clients,
      websites: websites.map((site) => ({ id: site.id, clientId: site.client_id })),
    });
    return { websites, staff: await listActiveStaff(db), selection };
  });
  const website = data.websites.find((site) => site.id === data.selection.websiteId);
  const allowed = Boolean(website && canEditClient(access, website.client_id));
  const reviewers = data.staff.filter((person) => person.platform_role === "admin" || person.platform_role === "manager" || person.platform_role === "reviewer");
  return (
    <>
      <PageHeader eyebrow={<Link href={website ? `/blog?client=${website.client_id}&website=${website.id}` : "/blog"} className="text-action hover:underline">Blog</Link>} title="New article" description={website ? `${website.client_name} · ${website.name}` : "Choose a website before writing."} />
      {!website || !allowed ? (
        <EmptyState title="Select a website">An article needs a client and website before it can be created. <Link href="/blog" className="text-action underline">Return to Blog</Link>.</EmptyState>
      ) : (
        <Card className="p-5">
          <ArticleForm action={createArticleAction} websites={data.websites} people={data.staff} reviewers={reviewers} lockedClientId={website.client_id} lockedWebsiteId={website.id} />
        </Card>
      )}
    </>
  );
}
