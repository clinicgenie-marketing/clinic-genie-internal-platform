import { canEditClient, listAdsAudits, listAdsChanges } from "@clinic-genie/db";
import { requireClientAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { AdsChangeTable, AuditTable } from "@/components/modules/AdsList";

export const dynamic = "force-dynamic";

export default async function ClientAdsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireClientAccess(id);
  const data = await staffTx(access, async (db) => ({ audits: await listAdsAudits(db, { clientId: id }), changes: await listAdsChanges(db, { clientId: id }) }));
  return (
    <>
      {canEditClient(access, id) && <div className="mb-4 flex justify-end gap-2"><LinkButton href={`/google-ads/audits/new?client=${id}`} variant="secondary">New audit</LinkButton><LinkButton href={`/google-ads/changes/new?client=${id}`}>Record a change</LinkButton></div>}
      <Card><CardHeader title="Audits" /><AuditTable audits={data.audits} showClient={false} /></Card>
      <Card className="mt-6"><CardHeader title="Change log" /><AdsChangeTable changes={data.changes} showClient={false} /></Card>
    </>
  );
}
