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
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted"><Link href="/clients" className="hover:text-action">Clients</Link></div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight">{client.name}</h1>
          <Badge tone={client.status === "active" ? "good" : "neutral"}>{client.status === "active" ? "Active" : "Inactive"}</Badge>
          {client.is_synthetic && <Badge tone="warn">Demonstration data</Badge>}
        </div>
        <div className="text-sm text-muted mt-1">
          {client.reference_number ? `${client.reference_number} · ` : ""}
          {client.short_code ? `${client.short_code} · ` : ""}
          {client.specialty ? `${client.specialty} · ` : ""}
          Clinic Genie owner: {client.owner_name ?? "Unassigned"}
        </div>
      </div>
      <ClientTabs clientId={id} />
      {children}
    </>
  );
}
