"use client";

import { useActionState } from "react";
import { REVIEW_DECISIONS, SOURCE_TYPES } from "@clinic-genie/contracts";
import { claimWorkflowAction, createClaimAction } from "@/app/actions/medical";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Field";
import { label } from "@/components/ui/Badge";

export function ClaimForm({ clientId }: { clientId: string }) {
  const [state, action, pending] = useActionState(createClaimAction, null);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="clientId" value={clientId} />
      <Field label="Claim summary" htmlFor="claimSummary" required hint="One line describing the claim being made.">
        <Input id="claimSummary" name="claimSummary" required maxLength={300} />
      </Field>
      <Field label="Where it appears" htmlFor="location" hint="Page, section or asset.">
        <Input id="location" name="location" maxLength={200} />
      </Field>
      <Field label="Proposed wording (version 1)" htmlFor="wording" required>
        <Textarea id="wording" name="wording" required maxLength={4000} rows={4} />
      </Field>
      <FormError state={state} />
      <Button type="submit" disabled={pending}>{pending ? "Saving" : "Create claim"}</Button>
    </form>
  );
}

function useWorkflow() {
  return useActionState(claimWorkflowAction, null);
}

export function WordingForm({ claimId }: { claimId: string }) {
  const [state, action, pending] = useWorkflow();
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="claimId" value={claimId} />
      <input type="hidden" name="op" value="wording" />
      <Field label="New wording" htmlFor="wording" required hint="Creates a new version. Earlier reviews are preserved and marked superseded; the claim returns to draft.">
        <Textarea id="wording" name="wording" required maxLength={4000} rows={4} />
      </Field>
      <FormError state={state} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>{pending ? "Saving" : "Add wording version"}</Button>
    </form>
  );
}

export function AssignReviewForm({ claimId, reviewers }: { claimId: string; reviewers: Array<{ id: string; display_name: string }> }) {
  const [state, action, pending] = useWorkflow();
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="claimId" value={claimId} />
      <input type="hidden" name="op" value="assign" />
      <Field label="Reviewer" htmlFor="reviewerUserId" required>
        <Select id="reviewerUserId" name="reviewerUserId" defaultValue="" required>
          <option value="" disabled>Choose</option>
          {reviewers.map((r) => <option key={r.id} value={r.id}>{r.display_name}</option>)}
        </Select>
      </Field>
      <FormError state={state} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>{pending ? "Saving" : "Assign review of current wording"}</Button>
    </form>
  );
}

export function SourceForm({ claimId }: { claimId: string }) {
  const [state, action, pending] = useWorkflow();
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="claimId" value={claimId} />
      <input type="hidden" name="op" value="source" />
      <Field label="Source title" htmlFor="src-title" required>
        <Input id="src-title" name="title" required maxLength={300} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type" htmlFor="src-type">
          <Select id="src-type" name="sourceType" defaultValue="peer_reviewed">{SOURCE_TYPES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
        </Field>
        <Field label="Link" htmlFor="src-url">
          <Input id="src-url" name="url" type="url" placeholder="https://" />
        </Field>
      </div>
      <Field label="Citation" htmlFor="src-citation">
        <Input id="src-citation" name="citation" maxLength={500} />
      </Field>
      <FormError state={state} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>{pending ? "Saving" : "Add source"}</Button>
    </form>
  );
}

export function DecisionForm({ claimId, reviewId }: { claimId: string; reviewId: string }) {
  const [state, action, pending] = useWorkflow();
  return (
    <form action={action} className="space-y-3 mt-3">
      <input type="hidden" name="claimId" value={claimId} />
      <input type="hidden" name="op" value="decide" />
      <input type="hidden" name="reviewId" value={reviewId} />
      <Field label="Decision" htmlFor={`dec-${reviewId}`}>
        <Select id={`dec-${reviewId}`} name="decision" defaultValue="changes_required">{REVIEW_DECISIONS.map((d) => <option key={d} value={d}>{label(d)}</option>)}</Select>
      </Field>
      <Field label="Reasoning" htmlFor={`note-${reviewId}`} required hint="Approval needs at least one recorded source. A decision is a workflow outcome, not regulatory certification.">
        <Textarea id={`note-${reviewId}`} name="note" required maxLength={4000} />
      </Field>
      <FormError state={state} />
      <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving" : "Record decision"}</Button>
    </form>
  );
}

export function WithdrawButton({ claimId }: { claimId: string }) {
  const [state, action, pending] = useWorkflow();
  return (
    <form action={action}>
      <input type="hidden" name="claimId" value={claimId} />
      <input type="hidden" name="op" value="withdraw" />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>Withdraw claim</Button>
      {state && !state.ok && <span role="alert" className="text-xs text-bad ml-2">{state.error}</span>}
    </form>
  );
}
