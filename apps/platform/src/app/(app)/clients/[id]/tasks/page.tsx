import { buildQueue, canEditClient, listTasks, todaySgt, type TaskStatus } from "@clinic-genie/db";
import { ACTIVE_TASK_STATUSES, TASK_STATUSES } from "@clinic-genie/contracts";
import { requireClientAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { FilterBar, FilterSelect } from "@/components/ui/Filters";
import { TaskTable } from "@/components/modules/TaskTable";
import { label } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

export default async function ClientTasksPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string }> }) {
  const { id } = await params;
  const { status } = await searchParams;
  const access = await requireClientAccess(id);
  const today = todaySgt();
  const statuses = status && (TASK_STATUSES as readonly string[]).includes(status) ? [status as TaskStatus] : ACTIVE_TASK_STATUSES;
  const tasks = await staffTx(access, (db) => listTasks(db, { clientId: id, statuses }));
  const q = buildQueue(tasks, today);
  const ordered = status === "completed" || status === "cancelled" ? tasks : [...q.urgent, ...q.dueToday, ...q.waiting, ...q.upcoming, ...q.later].map((x) => x.task);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
        <FilterBar>
          <FilterSelect name="status" label="Status" value={status} allLabel="All active" options={TASK_STATUSES.map((s) => ({ value: s, label: label(s) }))} />
        </FilterBar>
        {canEditClient(access, id) && <div className="mb-4"><LinkButton href={`/tasks/new?client=${id}`}>New task</LinkButton></div>}
      </div>
      <Card>
        <TaskTable tasks={ordered} today={today} showClient={false} caption="Client tasks" canAct={access.user.platform_role !== "read_only"} />
      </Card>
    </>
  );
}
