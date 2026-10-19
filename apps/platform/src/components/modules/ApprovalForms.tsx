"use client";

import { useActionState, type ReactNode } from "react";
import { APPROVAL_TYPES } from "@clinic-genie/contracts";
import { approvalWorkflowAction, createApprovalAction, updateApprovalAction } from "@/app/actions/approvals";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Field";
import { label } from "@/components/ui/Badge";

export function ApprovalForm({ mode, values, relatedPicker }: { mode: "create" | "edit"; values: { approvalId?: string; clientId: string; title?: string; summary?: string | null; requestType?: string }; relatedPicker: ReactNode }) {
  const [state, action, pending] = useActionState(mode === "create" ? createApprovalAction : updateApprovalAction, null);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="clientId" value={values.clientId} />
      {values.approvalId && <input type="hidden" name="approvalId" value={values.approvalId} />}
      <Field label="What needs approval" htmlFor="title" required>
        <Input id="title" name="title" defaultValue={values.title ?? ""} required maxLength={200} />
      </Field>
      <Field label="Type" htmlFor="requestType">
        <Select id="requestType" name="requestType" defaultValue={values.requestType ?? "other"}>
          {APPROVAL_TYPES.map((t) => (
            <option key={t} value={t}>{label(t)}</option>
          ))}
        </Select>
      </Field>
      <Field label="Summary and evidence" htmlFor="summary" hint="What is proposed, why, and where the decider can see it.">
        <Textarea id="summary" name="summary" defaultValue={values.summary ?? ""} maxLength={4000} rows={5} />
      </Field>
      {relatedPicker}
      <FormError state={state} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="submit" value="" variant="secondary" disabled={pending}>{mode === "create" ? "Save draft" : "Save draft"}</Button>
        <Button type="submit" name="submit" value="1" disabled={pending}>{pending ? "Saving" : "Submit for decision"}</Button>
      </div>
    </form>
  );
}

export function WorkflowButton({ approvalId, op, children, variant = "secondary" }: { approvalId: string; op: "submit" | "withdraw"; children: ReactNode; variant?: "secondary" | "danger" | "primary" }) {
  const [state, action, pending] = useActionState(approvalWorkflowAction, null);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="approvalId" value={approvalId} />
      <input type="hidden" name="op" value={op} />
      <Button type="submit" variant={variant} size="sm" disabled={pending}>{children}</Button>
      {state && !state.ok && <span role="alert" className="text-xs text-bad ml-2">{state.error}</span>}
    </form>
  );
}

export function DecisionForm({ approvalId, revising }: { approvalId: string; revising: boolean }) {
  const [state, action, pending] = useActionState(approvalWorkflowAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="approvalId" value={approvalId} />
      <Field label={revising ? "Reason for revising the decision" : "Decision note"} htmlFor="note" hint={revising ? "A new decision is recorded and linked. The earlier one stays in the history." : "Required when requesting changes."}>
        <Textarea id="note" name="note" maxLength={4000} />
      </Field>
      <FormError state={state} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="op" value="approve" disabled={pending}>{revising ? "Record approval" : "Approve"}</Button>
        <Button type="submit" name="op" value="changes" variant="secondary" disabled={pending}>Request changes</Button>
      </div>
    </form>
  );
}
