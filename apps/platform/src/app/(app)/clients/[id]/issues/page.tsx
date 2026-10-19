import { canEditClient, listIssues } from "@clinic-genie/db";
import { requireClientAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { IssueTable } from "@/components/modules/IssueList";

export const dynamic = "force-dynamic";

export default async function ClientIssuesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireClientAccess(id);
  const issues = await staffTx(access, (db) => listIssues(db, { clientId: id }));
  return (
    <>
      {(canEditClient(access, id) || access.user.platform_role === "reviewer") && <div className="mb-4 flex justify-end"><LinkButton href={`/issues/new?client=${id}`}>Open an issue</LinkButton></div>}
      <Card><IssueTable issues={issues} showClient={false} /></Card>
    </>
  );
}
