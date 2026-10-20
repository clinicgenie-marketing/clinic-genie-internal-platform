import Link from "next/link";
import { buildQueue, formatDateTime, getClient, listAccountReferences, listApprovals, listIssues, listMemberships, listTasks, listTimeline, listWebsites, todaySgt, canEditClient } from "@clinic-genie/db";
import { requireClientAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { Card, CardHeader, KeyValue, Stat } from "@/components/ui/Card";
import { Badge, label } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { TaskTable } from "@/components/modules/TaskTable";

export const dynamic = "force-dynamic";

export default async function ClientOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireClientAccess(id);
  const today = todaySgt();
  const data = await staffTx(access, async (db) => ({
    client: (await getClient(db, id))!,
    websites: await listWebsites(db, id),
    refs: await listAccountReferences(db, id),
    members: await listMemberships(db, id),
    tasks: await listTasks(db, { clientId: id }),
    approvals: await listApprovals(db, { clientId: id, statuses: ["submitted"] }),
    issues: await listIssues(db, { clientId: id, statuses: ["open", "investigating", "resolved_pending_verification", "reopened"] }),
    timeline: await listTimeline(db, { clientId: id, limit: 10 }),
  }));
  const queue = buildQueue(data.tasks, today);
  const top = [...queue.urgent, ...queue.dueToday, ...queue.waiting, ...queue.upcoming].slice(0, 6).map((q) => q.task);
  const canAct = canEditClient(access, id);
  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        <Stat label="Urgent tasks" value={queue.urgent.length} tone={queue.urgent.length ? "bad" : undefined} />
        <Stat label="Waiting" value={queue.waiting.length} hint={`${queue.waiting.filter((q) => q.followUpDue).length} follow-ups due`} />
        <Stat label="Approvals submitted" value={data.approvals.length} tone={data.approvals.length ? "warn" : undefined} />
        <Stat label="Open issues" value={data.issues.length} tone={data.issues.some((i) => i.severity === "critical") ? "bad" : undefined} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Priority tasks" action={<span className="flex gap-3"><Link href={`/clients/${id}/tasks`} className="text-sm text-action hover:underline">All tasks</Link>{canAct && <LinkButton href={`/tasks/new?client=${id}`} size="sm">New task</LinkButton>}</span>} />
            <TaskTable tasks={top} today={today} showClient={false} caption="Priority tasks" canAct={access.user.platform_role !== "read_only"} emptyLabel="No priority tasks yet." />
          </Card>
          <Card>
            <CardHeader title="Recent activity" action={<Link href={`/clients/${id}/timeline`} className="text-sm text-action hover:underline">Timeline</Link>} />
            <ol className="divide-y divide-line">
              {data.timeline.length === 0 && <li className="px-5 py-3 text-sm text-muted">No activity recorded yet.</li>}
              {data.timeline.map((e) => (
                <li key={e.id} className="px-5 py-2.5 text-sm flex flex-col sm:flex-row sm:gap-4">
                  <span className="text-xs text-muted whitespace-nowrap sm:w-36">{formatDateTime(e.occurred_at)}</span>
                  <span>{e.title}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-base font-semibold mb-3">Profile</h2>
            <KeyValue items={[
              { label: "Identifier", value: data.client.slug },
              { label: "Status", value: label(data.client.status) },
              { label: "Channels", value: data.client.channels.length ? <span className="flex flex-wrap gap-1">{data.client.channels.map((c) => <Badge key={c}>{label(c)}</Badge>)}</span> : null },
              { label: "Staff with access", value: data.members.map((m) => `${m.user_name} (${label(m.user_role)})`).join(", ") || null },
            ]} />
            {data.client.notes && <p className="text-sm text-muted mt-3 whitespace-pre-wrap">{data.client.notes}</p>}
            <Link href={`/clients/${id}/profile`} className="text-sm text-action hover:underline mt-3 inline-block">Edit profile, websites and references</Link>
          </Card>
          <Card className="p-5">
            <h2 className="text-base font-semibold mb-3">Websites</h2>
            <ul className="space-y-2 text-sm">
              {data.websites.length === 0 && <li className="text-muted">None recorded.</li>}
              {data.websites.map((w) => (
                <li key={w.id}>
                  <span className="font-medium">{w.name}</span> <Badge tone={w.status === "active" ? "good" : "neutral"}>{label(w.environment)}</Badge>
                  {w.url && <div><a href={w.url} className="text-action hover:underline break-all" rel="noreferrer" target="_blank">{w.url}</a></div>}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h2 className="text-base font-semibold mb-3">Account references</h2>
            <p className="text-xs text-muted mb-2">Saved links and identifiers only. Not connected integrations. Credentials live in the vault.</p>
            <ul className="space-y-2 text-sm">
              {data.refs.length === 0 && <li className="text-muted">None recorded.</li>}
              {data.refs.map((r) => (
                <li key={r.id}>
                  <Badge>{label(r.kind)}</Badge> <span className="font-medium">{r.label}</span>
                  {r.external_identifier && <span className="text-muted"> · {r.external_identifier}</span>}
                  {r.url && <div><a href={r.url} className="text-action hover:underline break-all" rel="noreferrer" target="_blank">{r.url}</a></div>}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
