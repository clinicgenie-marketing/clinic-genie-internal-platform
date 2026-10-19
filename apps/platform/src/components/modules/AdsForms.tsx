"use client";

import { useActionState } from "react";
import { FINDING_SEVERITIES } from "@clinic-genie/contracts";
import { addFindingAction, recordAdsChangeAction, saveAuditAction, verifyAdsChangeAction } from "@/app/actions/ads";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Field";
import { label } from "@/components/ui/Badge";

const AREAS = ["campaign", "ad_group", "keywords", "search_terms", "ads", "landing_pages", "budget", "bidding", "conversion_tracking", "other"];

export function AuditForm({ clientId, references, values }: { clientId: string; references: Array<{ id: string; label: string }>; values?: { id: string; account_reference_id: string | null; title: string; period_start: string; period_end: string; scope: string; summary: string | null } }) {
  const [state, action, pending] = useActionState(saveAuditAction, null);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="clientId" value={clientId} />
      {values && <input type="hidden" name="auditId" value={values.id} />}
      <Field label="Title" htmlFor="title" required>
        <Input id="title" name="title" defaultValue={values?.title ?? ""} required maxLength={200} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Review period from" htmlFor="periodStart" required>
          <Input id="periodStart" name="periodStart" type="date" defaultValue={values?.period_start ?? ""} required />
        </Field>
        <Field label="to" htmlFor="periodEnd" required>
          <Input id="periodEnd" name="periodEnd" type="date" defaultValue={values?.period_end ?? ""} required />
        </Field>
        <Field label="Account reference" htmlFor="accountReferenceId" hint="Saved reference, not a connection.">
          <Select id="accountReferenceId" name="accountReferenceId" defaultValue={values?.account_reference_id ?? ""}>
            <option value="">None</option>
            {references.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Scope" htmlFor="scope" required hint="Which campaigns, ad groups, keywords or landing pages were reviewed.">
        <Input id="scope" name="scope" defaultValue={values?.scope ?? ""} required maxLength={500} />
      </Field>
      <Field label="Summary" htmlFor="summary">
        <Textarea id="summary" name="summary" defaultValue={values?.summary ?? ""} maxLength={4000} />
      </Field>
      <FormError state={state} />
      <Button type="submit" disabled={pending}>{pending ? "Saving" : values ? "Save audit" : "Open audit"}</Button>
    </form>
  );
}

export function FindingForm({ auditId }: { auditId: string }) {
  const [state, action, pending] = useActionState(addFindingAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="auditId" value={auditId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Area" htmlFor="area">
          <Select id="area" name="area" defaultValue="search_terms">{AREAS.map((a) => <option key={a} value={a}>{label(a)}</option>)}</Select>
        </Field>
        <Field label="Severity" htmlFor="severity">
          <Select id="severity" name="severity" defaultValue="medium">{FINDING_SEVERITIES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
        </Field>
      </div>
      <Field label="Finding" htmlFor="finding" required>
        <Textarea id="finding" name="finding" required maxLength={2000} rows={2} />
      </Field>
      <Field label="Recommendation" htmlFor="recommendation">
        <Textarea id="recommendation" name="recommendation" maxLength={2000} rows={2} />
      </Field>
      <FormError state={state} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>{pending ? "Saving" : "Add finding"}</Button>
    </form>
  );
}

export function AdsChangeForm({ clientId, audits, findings, approvals, staff, defaultAuditId, defaultFindingId, actorId }: {
  clientId: string;
  audits: Array<{ id: string; title: string }>;
  findings: Array<{ id: string; audit_id: string; finding: string }>;
  approvals: Array<{ id: string; title: string }>;
  staff: Array<{ id: string; display_name: string }>;
  defaultAuditId?: string;
  defaultFindingId?: string;
  actorId: string;
}) {
  const [state, action, pending] = useActionState(recordAdsChangeAction, null);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="clientId" value={clientId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Audit" htmlFor="auditId" hint="Optional.">
          <Select id="auditId" name="auditId" defaultValue={defaultAuditId ?? ""}>
            <option value="">None</option>
            {audits.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
          </Select>
        </Field>
        <Field label="Finding addressed" htmlFor="findingId" hint="Optional. Marks the finding implemented.">
          <Select id="findingId" name="findingId" defaultValue={defaultFindingId ?? ""}>
            <option value="">None</option>
            {findings.map((f) => <option key={f.id} value={f.id}>{f.finding.slice(0, 90)}</option>)}
          </Select>
        </Field>
        <Field label="Where (campaign, ad group, keyword)" htmlFor="scope" required>
          <Input id="scope" name="scope" required maxLength={300} />
        </Field>
        <Field label="Implemented on" htmlFor="implementedOn" required>
          <Input id="implementedOn" name="implementedOn" type="date" required />
        </Field>
        <Field label="Before" htmlFor="beforeValue">
          <Textarea id="beforeValue" name="beforeValue" maxLength={2000} rows={2} />
        </Field>
        <Field label="After" htmlFor="afterValue">
          <Textarea id="afterValue" name="afterValue" maxLength={2000} rows={2} />
        </Field>
        <Field label="Responsible staff" htmlFor="responsibleUserId" required>
          <Select id="responsibleUserId" name="responsibleUserId" defaultValue={actorId}>{staff.map((s) => <option key={s.id} value={s.id}>{s.display_name}</option>)}</Select>
        </Field>
        <Field label="Approval reference" htmlFor="approvalId">
          <Select id="approvalId" name="approvalId" defaultValue="">
            <option value="">None</option>
            {approvals.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="What was changed" htmlFor="description" required>
        <Textarea id="description" name="description" required maxLength={2000} rows={2} />
      </Field>
      <Field label="Reason" htmlFor="reason" required>
        <Input id="reason" name="reason" required maxLength={500} />
      </Field>
      <FormError state={state} />
      <Button type="submit" disabled={pending}>{pending ? "Saving" : "Record change"}</Button>
    </form>
  );
}

export function VerifyAdsChangeForm({ changeId }: { changeId: string }) {
  const [state, action, pending] = useActionState(verifyAdsChangeAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="changeId" value={changeId} />
      <Field label="Verified on" htmlFor="verificationOn" required>
        <Input id="verificationOn" name="verificationOn" type="date" required />
      </Field>
      <Field label="What was observed afterwards" htmlFor="outcomeNote" required hint="Later movement is observed, not proof the change caused it.">
        <Textarea id="outcomeNote" name="outcomeNote" required maxLength={2000} />
      </Field>
      <FormError state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Saving" : "Record verification"}</Button>
    </form>
  );
}
