import { listActiveStaff, listBlogWebsites } from "@clinic-genie/db";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui/Card";
import { createArticleAction } from "@/app/actions/blog";
import { ArticleForm } from "@/components/modules/blog/ArticleForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "New article" };

export default async function NewArticlePage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const access = await requireAccess();
  const params = await searchParams;
  const data = await staffTx(access, async (db) => ({
    websites: await listBlogWebsites(db),
    staff: await listActiveStaff(db),
  }));
  const reviewers = data.staff.filter((person) => person.platform_role === "admin" || person.platform_role === "manager" || person.platform_role === "reviewer");
  return (
    <>
      <PageHeader title="New article" description="Drafts stay in Genie Works until an admin or manager publishes them to a native website." />
      <Card className="p-5">
        <ArticleForm action={createArticleAction} websites={data.websites} people={data.staff} reviewers={reviewers} lockedClientId={params.client} />
      </Card>
    </>
  );
}
