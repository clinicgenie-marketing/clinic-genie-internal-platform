"use client";

import { useActionState } from "react";
import { CONTENT_STATUSES, MAPPING_FLAGS, SEARCH_INTENTS } from "@clinic-genie/contracts";
import { recordChangeAction, savePageAction, verifyChangeAction } from "@/app/actions/seo";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/Field";
import { label } from "@/components/ui/Badge";

const CHANGE_TYPES = ["title", "meta_description", "heading", "body_content", "internal_links", "keyword_target", "url", "schema", "other"];

export function SeoPageForm({ clientId, websites, owners, values }: { clientId: string; websites: Array<{ id: string; name: string }>; owners: Array<{ id: string; display_name: string }>; values?: Record<string, unknown> & { id?: string } }) {
  const [state, action, pending] = useActionState(savePageAction, null);
  const v = (k: string) => (values?.[k] as string | null | undefined) ?? "";
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="clientId" value={clientId} />
      {values?.id && <input type="hidden" name="pageId" value={values.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Page path or URL" htmlFor="pagePath" required hint="For example /dental-implants.">
          <Input id="pagePath" name="pagePath" defaultValue={v("page_path")} required maxLength={500} />
        </Field>
        <Field label="Website" htmlFor="websiteId">
          <Select id="websiteId" name="websiteId" defaultValue={v("website_id")}>
            <option value="">Not linked</option>
            {websites.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </Select>
        </Field>
        <Field label="Page title" htmlFor="pageTitle">
          <Input id="pageTitle" name="pageTitle" defaultValue={v("page_title")} maxLength={200} />
        </Field>
        <Field label="Owner" htmlFor="ownerUserId">
          <Select id="ownerUserId" name="ownerUserId" defaultValue={v("owner_user_id")}>
            <option value="">Unassigned</option>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.display_name}</option>)}
          </Select>
        </Field>
        <Field label="Primary keyword" htmlFor="primaryKeyword">
          <Input id="primaryKeyword" name="primaryKeyword" defaultValue={v("primary_keyword")} maxLength={120} />
        </Field>
        <Field label="Secondary keywords" htmlFor="secondaryKeywords" hint="Comma separated.">
          <Input id="secondaryKeywords" name="secondaryKeywords" defaultValue={((values?.secondary_keywords as string[] | undefined) ?? []).join(", ")} maxLength={500} />
        </Field>
        <Field label="Search intent" htmlFor="searchIntent">
          <Select id="searchIntent" name="searchIntent" defaultValue={v("search_intent")}>
            <option value="">Not set</option>
            {SEARCH_INTENTS.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </Select>
        </Field>
        <Field label="Content status" htmlFor="contentStatus">
          <Select id="contentStatus" name="contentStatus" defaultValue={v("content_status") || "planned"}>
            {CONTENT_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </Select>
        </Field>
        <Field label="Last reviewed on" htmlFor="lastReviewedOn">
          <Input id="lastReviewedOn" name="lastReviewedOn" type="date" defaultValue={v("last_reviewed_on")} />
        </Field>
        <Field label="Next review on" htmlFor="nextReviewOn">
          <Input id="nextReviewOn" name="nextReviewOn" type="date" defaultValue={v("next_review_on")} />
        </Field>
        <Field label="Mapping flag" htmlFor="mappingFlag" hint="A manual flag. The platform has not crawled or verified the site.">
          <Select id="mappingFlag" name="mappingFlag" defaultValue={v("mapping_flag") || "none"}>
            {MAPPING_FLAGS.map((f) => <option key={f} value={f}>{label(f)}</option>)}
          </Select>
        </Field>
        <Field label="Flag note" htmlFor="flagNote" hint="Required when a flag is set.">
          <Input id="flagNote" name="flagNote" defaultValue={v("flag_note")} maxLength={500} />
        </Field>
      </div>
      <Field label="Notes" htmlFor="notes">
        <Textarea id="notes" name="notes" defaultValue={v("notes")} maxLength={4000} />
      </Field>
      <FormError state={state} />
      <Button type="submit" disabled={pending}>{pending ? "Saving" : values?.id ? "Save page" : "Add page"}</Button>
    </form>
  );
}

export function SeoChangeForm({ pageId, approvals }: { pageId: string; approvals: Array<{ id: string; title: string }> }) {
  const [state, action, pending] = useActionState(recordChangeAction, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="pageId" value={pageId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="What changed" htmlFor="changeType">
          <Select id="changeType" name="changeType" defaultValue="title">
            {CHANGE_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
          </Select>
        </Field>
        <Field label="Changed on" htmlFor="changedOn" required>
          <Input id="changedOn" name="changedOn" type="date" required />
        </Field>
        <Field label="Before" htmlFor="beforeValue">
          <Textarea id="beforeValue" name="beforeValue" maxLength={4000} rows={2} />
        </Field>
        <Field label="After" htmlFor="afterValue">
          <Textarea id="afterValue" name="afterValue" maxLength={4000} rows={2} />
        </Field>
      </div>
      <Field label="Reason" htmlFor="reason" required>
        <Input id="reason" name="reason" required maxLength={500} />
      </Field>
      <Field label="Approval reference" htmlFor="approvalId" hint="Optional link to the decision that authorised this change.">
        <Select id="approvalId" name="approvalId" defaultValue="">
          <option value="">None</option>
          {approvals.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
        </Select>
      </Field>
      <FormError state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Saving" : "Record change"}</Button>
    </form>
  );
}

export function VerifyChangeForm({ pageId, changeId }: { pageId: string; changeId: string }) {
  const [state, action, pending] = useActionState(verifyChangeAction, null);
  return (
    <form action={action} className="mt-2 grid gap-2 sm:grid-cols-[auto_1fr_auto] items-end">
      <input type="hidden" name="pageId" value={pageId} />
      <input type="hidden" name="changeId" value={changeId} />
      <Field label="Verified on" htmlFor={`v-on-${changeId}`} required>
        <Input id={`v-on-${changeId}`} name="verificationOn" type="date" required />
      </Field>
      <Field label="What was observed afterwards" htmlFor={`v-note-${changeId}`} required hint="Observed movement, not proven cause.">
        <Input id={`v-note-${changeId}`} name="outcomeNote" required maxLength={2000} />
      </Field>
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>Record</Button>
      {state && !state.ok && <p role="alert" className="text-xs text-bad sm:col-span-3">{state.error}</p>}
    </form>
  );
}
