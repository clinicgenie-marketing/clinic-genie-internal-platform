import { buildQueue, listTasks, todaySgt, type TaskStatus } from "@clinic-genie/db";
import { ACTIVE_TASK_STATUSES, TASK_STATUSES } from "@clinic-genie/contracts";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { FilterBar, FilterSelect } from "@/components/ui/Filters";
import { TaskTable } from "@/components/modules/TaskTable";
import { label } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "My tasks" };

export default async function MyTasksPage({ searchParams }: { searchParams: Promise<{ status?: string; scope?: string }> }) {
  const access = await requireAccess();
  const { status, scope } = await searchParams;
  const today = todaySgt();
  const statuses = status && (TASK_STATUSES as readonly string[]).includes(status) ? [status as TaskStatus] : ACTIVE_TASK_STATUSES;
  const tasks = await staffTx(access, (db) => listTasks(db, { ownerUserId: scope === "all" ? undefined : access.user.id, statuses }));
  const queue = buildQueue(tasks, today);
  const ordered = [...queue.urgent, ...queue.dueToday, ...queue.waiting, ...queue.upcoming, ...queue.later].map((q) => q.task);
  const shown = status === "completed" || status === "cancelled" ? tasks : ordered;
  return (
    <>
      <PageHeader title={scope === "all" ? "All tasks" : "My tasks"} description="Ordered by the queue score, then due date. Completed and cancelled tasks are listed only when you filter for them." action={access.user.platform_role !== "read_only" ? <LinkButton href="/tasks/new">New task</LinkButton> : undefined} />
      <FilterBar>
        <FilterSelect name="status" label="Status" value={status} allLabel="All active" options={TASK_STATUSES.map((s) => ({ value: s, label: label(s) }))} />
        <FilterSelect name="scope" label="Owner" value={scope} allLabel="Mine" options={[{ value: "all", label: "Everyone I can see" }]} />
      </FilterBar>
      <Card>
        <TaskTable tasks={shown} today={today} caption="Tasks" canAct={access.user.platform_role !== "read_only"} />
      </Card>
    </>
  );
}
