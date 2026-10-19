import { listClients } from "@clinic-genie/db";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui/Card";
import { ReportsModule, type ReportParams } from "@/components/modules/ReportsModule";
import { Field, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<ReportParams & { client?: string }> }) {
  const access = await requireAccess();
  const params = await searchParams;
  const clients = await staffTx(access, (db) => listClients(db));
  const chosen = clients.find((c) => c.id === params.client) ?? null;
  return (
    <>
      <PageHeader title="Performance reporting" description="Immutable snapshots per client, source, channel, metric and period, compared like-for-like. Missing figures are unavailable, not zero." />
      <Card className="p-4 mb-6">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <Field label="Client" htmlFor="client" required>
            <Select id="client" name="client" defaultValue={chosen?.id ?? ""} required>
              <option value="" disabled>Choose a client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Button type="submit" variant="secondary">Open</Button>
        </form>
      </Card>
      {chosen && await staffTx(access, (db) => ReportsModule({ db, access, clientId: chosen.id, params, action: "/reports" }))}
    </>
  );
}
