import { canEditClient, listClaims } from "@clinic-genie/db";
import { requireClientAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { ClaimTable } from "@/components/modules/ClaimList";

export const dynamic = "force-dynamic";

export default async function ClientMedicalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireClientAccess(id);
  const claims = await staffTx(access, (db) => listClaims(db, { clientId: id }));
  return (
    <>
      {canEditClient(access, id) && <div className="mb-4 flex justify-end"><LinkButton href={`/medical-review/new?client=${id}`}>New claim</LinkButton></div>}
      <Card><ClaimTable claims={claims} showClient={false} /></Card>
    </>
  );
}
