"use client";

import { useActionState } from "react";
import { transitionTaskAction } from "@/app/actions/tasks";
import { Button } from "@/components/ui/Button";
import type { TaskStatus } from "@clinic-genie/contracts";

/** One-click status changes that save to the database and refresh the page data. */
export function QuickTaskActions({ taskId, status, compact = false }: { taskId: string; status: TaskStatus; compact?: boolean }) {
  const [state, action, pending] = useActionState(transitionTaskAction, null);
  const next: Array<{ to: TaskStatus; label: string; variant: "primary" | "secondary" | "ghost" }> =
    status === "open" ? [{ to: "in_progress", label: "Start", variant: "secondary" }, { to: "completed", label: "Complete", variant: "primary" }]
    : status === "in_progress" ? [{ to: "completed", label: "Complete", variant: "primary" }]
    : status === "waiting" ? [{ to: "in_progress", label: "Resume", variant: "secondary" }, { to: "completed", label: "Complete", variant: "primary" }]
    : [{ to: "open", label: "Reopen", variant: "secondary" }];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {next.map((n) => (
        <form key={n.to} action={action}>
          <input type="hidden" name="taskId" value={taskId} />
          <input type="hidden" name="status" value={n.to} />
          <Button type="submit" variant={n.variant} size="sm" disabled={pending} aria-label={`${n.label} task`} className={compact ? "px-2.5" : ""}>{pending ? "Saving" : n.label}</Button>
        </form>
      ))}
      {state && !state.ok && <span role="alert" className="text-xs text-bad">{state.error}</span>}
    </div>
  );
}
