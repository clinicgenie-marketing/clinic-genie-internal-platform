import { canEditClient, listApprovals } from "@clinic-genie/db";
import { requireClientAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { ApprovalTable } from "@/components/modules/ApprovalList";

export const dynamic = "force-dynamic";

export default async function ClientApprovalsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireClientAccess(id);
  const approvals = await staffTx(access, (db) => listApprovals(db, { clientId: id }));
  return (
    <>
      {canEditClient(access, id) && <div className="mb-4 flex justify-end"><LinkButton href={`/approvals/new?client=${id}`}>New request</LinkButton></div>}
      <Card><ApprovalTable approvals={approvals} showClient={false} /></Card>
    </>
  );
}
