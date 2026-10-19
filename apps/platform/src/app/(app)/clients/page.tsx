import Link from "next/link";
import { canManageRegistry, listClients, listTasks, todaySgt, buildQueue } from "@clinic-genie/db";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { Badge, label } from "@/components/ui/Badge";
import { Table, Td, Th } from "@/components/ui/Table";
import { Notice } from "@/components/ui/Notice";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ archived?: string; denied?: string }> }) {
  const access = await requireAccess();
  const { archived, denied } = await searchParams;
  const today = todaySgt();
  const data = await staffTx(access, async (db) => {
    const clients = await listClients(db, { includeArchived: archived === "1" });
    const tasks = await listTasks(db, {});
    return { clients, tasks };
  });
  const byClient = new Map<string, { open: number; urgent: number; waiting: number }>();
  for (const c of data.clients) {
    const q = buildQueue(data.tasks.filter((t) => t.client_id === c.id), today);
    byClient.set(c.id, { open: q.urgent.length + q.dueToday.length + q.waiting.length + q.upcoming.length + q.later.length, urgent: q.urgent.length, waiting: q.waiting.length });
  }
  return (
    <>
      <PageHeader title="Clients" description="Every record in the platform links back to one client." action={canManageRegistry(access) ? <LinkButton href="/clients/new">New client</LinkButton> : undefined} />
      {denied && <div className="mb-4"><Notice tone="bad" title="Not available">You do not have access to that client.</Notice></div>}
      <div className="mb-3 text-sm">
        {archived === "1" ? <Link href="/clients" className="text-action hover:underline">Hide archived</Link> : <Link href="/clients?archived=1" className="text-action hover:underline">Show archived</Link>}
      </div>
      <Card>
        <Table caption="Clients">
          <thead>
            <tr>
              <Th>Client</Th>
              <Th>Accountable owner</Th>
              <Th>Channels</Th>
              <Th align="right">Open tasks</Th>
              <Th align="right">Urgent</Th>
              <Th align="right">Waiting</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {data.clients.map((c) => {
              const s = byClient.get(c.id)!;
              return (
                <tr key={c.id} className="hover:bg-surface-muted/60">
                  <Td>
                    <Link href={`/clients/${c.id}`} className="font-medium text-action hover:underline">{c.name}</Link>
                    <div className="text-xs text-muted">{c.slug}{c.is_synthetic ? " · demonstration data" : ""}</div>
                  </Td>
                  <Td>{c.owner_name ?? <span className="text-muted">Unassigned</span>}</Td>
                  <Td><div className="flex flex-wrap gap-1">{c.channels.map((ch) => <Badge key={ch}>{label(ch)}</Badge>)}</div></Td>
                  <Td align="right">{s.open}</Td>
                  <Td align="right">{s.urgent > 0 ? <span className="text-bad font-semibold">{s.urgent}</span> : 0}</Td>
                  <Td align="right">{s.waiting}</Td>
                  <Td><Badge tone={c.status === "active" ? "good" : "neutral"}>{label(c.status)}</Badge></Td>
                </tr>
              );
            })}
            {data.clients.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-muted">No clients are visible to you. Ask an administrator for access.</td></tr>
            )}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
