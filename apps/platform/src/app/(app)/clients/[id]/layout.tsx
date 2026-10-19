import Link from "next/link";
import { notFound } from "next/navigation";
import { getClient } from "@clinic-genie/db";
import { requireClientAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { Badge } from "@/components/ui/Badge";
import { ClientTabs } from "@/components/shell/ClientTabs";

export default async function ClientLayout({ params, children }: { params: Promise<{ id: string }>; children: React.ReactNode }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const access = await requireClientAccess(id);
  const client = await staffTx(access, (db) => getClient(db, id));
  if (!client) notFound();
  return (
    <>
      <div className="mb-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted"><Link href="/clients" className="hover:underline">Clients</Link></div>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <h1 className="text-2xl font-semibold leading-tight">{client.name}</h1>
          {client.status === "archived" && <Badge tone="neutral">Archived</Badge>}
          {client.is_synthetic && <Badge tone="warn">Demonstration data</Badge>}
        </div>
        <div className="text-sm text-muted mt-1">Accountable owner: {client.owner_name ?? "Unassigned"}</div>
      </div>
      <ClientTabs clientId={id} />
      {children}
    </>
  );
}
