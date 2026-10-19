"use client";

import { useActionState, useState } from "react";
import { addTaskNoteAction, transitionTaskAction } from "@/app/actions/tasks";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Field";
import { label } from "@/components/ui/Badge";
import type { TaskStatus } from "@clinic-genie/contracts";

const NEXT: Record<TaskStatus, TaskStatus[]> = {
  open: ["in_progress", "waiting", "completed", "cancelled"],
  in_progress: ["open", "waiting", "completed", "cancelled"],
  waiting: ["open", "in_progress", "completed", "cancelled"],
  completed: ["open"],
  cancelled: ["open"],
};

export function TaskTransitionForm({ taskId, status, waitingOn, followUpDate }: { taskId: string; status: TaskStatus; waitingOn: string | null; followUpDate: string | null }) {
  const [state, action, pending] = useActionState(transitionTaskAction, null);
  const [next, setNext] = useState<TaskStatus>(NEXT[status][0]!);
  const err = (f: string) => (state && !state.ok && state.field === f ? state.error : null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="taskId" value={taskId} />
      <Field label="New status" htmlFor="status">
        <Select id="status" name="status" value={next} onChange={(e) => setNext(e.target.value as TaskStatus)}>
          {NEXT[status].map((s) => (
            <option key={s} value={s}>{label(s)}</option>
          ))}
        </Select>
      </Field>
      {next === "waiting" && (
        <>
          <Field label="Waiting on" htmlFor="waitingOn" required error={err("waitingOn")} hint="Who or what must happen before work continues.">
            <Input id="waitingOn" name="waitingOn" defaultValue={waitingOn ?? ""} required maxLength={200} />
          </Field>
          <Field label="Follow-up date" htmlFor="followUpDate" required error={err("followUpDate")} hint="When to chase. Separate from the deadline.">
            <Input id="followUpDate" name="followUpDate" type="date" defaultValue={followUpDate ?? ""} required />
          </Field>
        </>
      )}
      <Field label="Note" htmlFor="note" hint={next === "completed" ? "What was done, with evidence where useful." : "Optional"}>
        <Textarea id="note" name="note" maxLength={2000} />
      </Field>
      <FormError state={state} />
      <Button type="submit" disabled={pending}>{pending ? "Saving" : `Mark ${label(next).toLowerCase()}`}</Button>
    </form>
  );
}

export function TaskNoteForm({ taskId }: { taskId: string }) {
  const [state, action, pending] = useActionState(addTaskNoteAction, null);
  return (
    <form action={action} className="space-y-3 mt-3">
      <input type="hidden" name="taskId" value={taskId} />
      <Field label="Add a note" htmlFor="body">
        <Textarea id="body" name="body" required maxLength={4000} />
      </Field>
      <FormError state={state} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>{pending ? "Saving" : "Add note"}</Button>
    </form>
  );
}
