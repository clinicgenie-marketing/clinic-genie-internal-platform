import Link from "next/link";
import { buildQueue, listApprovals, listIssues, listTasks, listTimeline, todaySgt, canReviewClient, formatDate, formatDateTime, type QueuedTask } from "@clinic-genie/db";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { PageHeader, Stat, Card, CardHeader } from "@/components/ui/Card";
import { Badge, PRIORITY_TONE, label } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { QuickTaskActions } from "@/components/modules/QuickTaskActions";
import { EmptyState } from "@/components/ui/Notice";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

function QueueSection({ title, items, empty, canAct }: { title: string; items: QueuedTask[]; empty: string; canAct: boolean }) {
  return (
    <Card>
      <CardHeader title={title} description={`${items.length} task${items.length === 1 ? "" : "s"}`} />
      <ul className="divide-y divide-line">
        {items.length === 0 && <li className="px-5 py-4 text-sm text-muted">{empty}</li>}
        {items.slice(0, 8).map(({ task, reasons, daysOverdue, followUpDue }) => (
          <li key={task.id} className="px-5 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Link href={`/tasks/${task.id}`} className="font-medium text-action hover:underline">{task.title}</Link>
              <div className="text-xs text-muted mt-0.5 flex flex-wrap gap-x-2">
                <span>{task.client_name}</span>
                <span>Owner {task.owner_name}</span>
                {task.due_date && <span>Due {formatDate(task.due_date)}</span>}
                {task.status === "waiting" && <span>Waiting on {task.waiting_on}, follow up {formatDate(task.follow_up_date)}</span>}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                <Badge tone={PRIORITY_TONE[task.priority]}>{label(task.priority)}</Badge>
                {daysOverdue > 0 && <Badge tone="bad">{daysOverdue} day{daysOverdue === 1 ? "" : "s"} overdue</Badge>}
                {followUpDue && <Badge tone="warn">Follow-up due</Badge>}
                <span className="sr-only">Score reasons: {reasons.join(", ")}</span>
              </div>
            </div>
            {canAct && <QuickTaskActions taskId={task.id} status={task.status} compact />}
          </li>
        ))}
        {items.length > 8 && (
          <li className="px-5 py-3 text-sm">
            <Link href="/my-tasks" className="text-action hover:underline">See all {items.length} in My tasks</Link>
          </li>
        )}
      </ul>
    </Card>
  );
}

export default async function DashboardPage() {
  const access = await requireAccess();
  const today = todaySgt();
  const data = await staffTx(access, async (db) => {
    const tasks = await listTasks(db, {});
    const approvals = await listApprovals(db, { statuses: ["submitted"] });
    const issues = await listIssues(db, { statuses: ["resolved_pending_verification", "reopened"] });
    const timeline = await listTimeline(db, { limit: 8 });
    return { tasks, approvals, issues, timeline };
  });
  const queue = buildQueue(data.tasks, today);
  const mine = data.tasks.filter((t) => t.owner_user_id === access.user.id);
  const myQueue = buildQueue(mine, today);
  const canAct = access.user.platform_role !== "read_only";
  const approvalsForMe = data.approvals.filter((a) => canReviewClient(access, a.client_id) && a.requested_by !== access.user.id);

  return (
    <>
      <PageHeader
        eyebrow={formatDate(today)}
        title={`Good day, ${access.user.display_name.split(" ")[0]}`}
        description="What needs attention across your clients. Scores are deterministic; see docs/QUEUE_SCORING.md."
        action={canAct ? <LinkButton href="/tasks/new">New task</LinkButton> : undefined}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        <Stat label="Urgent" value={queue.urgent.length} tone={queue.urgent.length ? "bad" : undefined} hint="Overdue or critical within 2 days" />
        <Stat label="Due today" value={queue.dueToday.length} tone={queue.dueToday.length ? "warn" : undefined} hint="Across your clients" />
        <Stat label="Waiting" value={queue.waiting.length} hint={`${queue.waiting.filter((q) => q.followUpDue).length} follow-ups due`} />
        <Stat label="Approvals to decide" value={approvalsForMe.length} tone={approvalsForMe.length ? "warn" : undefined} hint="Submitted and waiting for you" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <QueueSection title="Urgent" items={queue.urgent} empty="Nothing overdue. Good." canAct={canAct} />
        <QueueSection title="Due today" items={queue.dueToday} empty="Nothing due today." canAct={canAct} />
        <QueueSection title="Waiting on others" items={queue.waiting} empty="No tasks are waiting." canAct={canAct} />
        <QueueSection title="Upcoming (next 7 days)" items={queue.upcoming} empty="Nothing due in the next week." canAct={canAct} />
      </div>
      <div className="grid gap-6 xl:grid-cols-3 mt-6">
        <Card>
          <CardHeader title="My tasks" description={`${myQueue.urgent.length} urgent, ${myQueue.dueToday.length} due today`} action={<Link href="/my-tasks" className="text-sm text-action hover:underline">Open</Link>} />
          <ul className="divide-y divide-line">
            {mine.length === 0 && <li className="px-5 py-4 text-sm text-muted">No tasks are assigned to you.</li>}
            {[...myQueue.urgent, ...myQueue.dueToday, ...myQueue.waiting, ...myQueue.upcoming].slice(0, 6).map(({ task }) => (
              <li key={task.id} className="px-5 py-2.5 text-sm">
                <Link href={`/tasks/${task.id}`} className="text-action hover:underline">{task.title}</Link>
                <span className="text-muted"> for {task.client_name}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Approvals waiting" action={<Link href="/approvals" className="text-sm text-action hover:underline">Open</Link>} />
          <ul className="divide-y divide-line">
            {data.approvals.length === 0 && <li className="px-5 py-4 text-sm text-muted">No submitted approvals.</li>}
            {data.approvals.slice(0, 6).map((a) => (
              <li key={a.id} className="px-5 py-2.5 text-sm">
                <Link href={`/approvals/${a.id}`} className="text-action hover:underline">{a.title}</Link>
                <div className="text-xs text-muted">{a.client_name}, requested by {a.requester_name}</div>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Issues needing verification" action={<Link href="/issues" className="text-sm text-action hover:underline">Open</Link>} />
          <ul className="divide-y divide-line">
            {data.issues.length === 0 && <li className="px-5 py-4 text-sm text-muted">No issues await verification.</li>}
            {data.issues.slice(0, 6).map((i) => (
              <li key={i.id} className="px-5 py-2.5 text-sm">
                <Link href={`/issues/${i.id}`} className="text-action hover:underline">{i.title}</Link>
                <div className="text-xs text-muted">{i.client_name}, {label(i.status)}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader title="Recent changes" description="From the change and outcome timeline" action={<Link href="/timeline" className="text-sm text-action hover:underline">Open timeline</Link>} />
        {data.timeline.length === 0 ? (
          <div className="px-5 pb-5"><EmptyState title="No events yet">Events appear here as tasks, decisions, changes and verifications are recorded.</EmptyState></div>
        ) : (
          <ol className="divide-y divide-line">
            {data.timeline.map((e) => (
              <li key={e.id} className="px-5 py-2.5 text-sm flex flex-col sm:flex-row sm:gap-4">
                <span className="text-xs text-muted whitespace-nowrap sm:w-40">{formatDateTime(e.occurred_at)}</span>
                <span className="min-w-0">
                  <span className="font-medium">{e.title}</span>
                  <span className="text-muted"> ({e.client_name})</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  );
}
