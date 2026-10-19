"use client";

import { useActionState } from "react";
import { ACCOUNT_REFERENCE_KINDS, CLIENT_CHANNELS } from "@clinic-genie/contracts";
import { createClientAction, saveReferenceAction, saveWebsiteAction, updateClientAction } from "@/app/actions/clients";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/Field";
import { label } from "@/components/ui/Badge";

type Staff = Array<{ id: string; display_name: string }>;

export function ClientForm({ mode, staff, values }: { mode: "create" | "edit"; staff: Staff; values: { clientId?: string; slug?: string; name?: string; ownerUserId?: string | null; channels?: string[]; notes?: string | null; isSynthetic?: boolean } }) {
  const [state, action, pending] = useActionState(mode === "create" ? createClientAction : updateClientAction, null);
  const err = (f: string) => (state && !state.ok && state.field === f ? state.error : null);
  return (
    <form action={action} className="space-y-5">
      {values.clientId && <input type="hidden" name="clientId" value={values.clientId} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client name" htmlFor="name" required>
          <Input id="name" name="name" defaultValue={values.name ?? ""} required maxLength={120} />
        </Field>
        {mode === "create" ? (
          <Field label="Identifier" htmlFor="slug" required hint="Lowercase, numbers and hyphens. Permanent." error={err("slug")}>
            <Input id="slug" name="slug" defaultValue={values.slug ?? ""} required pattern="[a-z0-9][a-z0-9-]{1,62}" />
          </Field>
        ) : (
          <Field label="Identifier" htmlFor="slug-ro"><Input id="slug-ro" value={values.slug ?? ""} readOnly aria-readonly /></Field>
        )}
      </div>
      <Field label="Accountable owner" htmlFor="ownerUserId" hint="The staff member answerable for this client.">
        <Select id="ownerUserId" name="ownerUserId" defaultValue={values.ownerUserId ?? ""}>
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>{s.display_name}</option>
          ))}
        </Select>
      </Field>
      <fieldset>
        <legend className="text-sm font-medium mb-1">Active channels</legend>
        <div className="flex flex-wrap gap-x-5">
          {CLIENT_CHANNELS.map((c) => (
            <Checkbox key={c} name="channels" value={c} defaultChecked={values.channels?.includes(c)} label={label(c)} />
          ))}
        </div>
      </fieldset>
      <Field label="Notes" htmlFor="notes">
        <Textarea id="notes" name="notes" defaultValue={values.notes ?? ""} maxLength={4000} />
      </Field>
      {mode === "create" && <Checkbox name="isSynthetic" label="This is demonstration data (fictional client)" defaultChecked={values.isSynthetic} />}
      <FormError state={state} />
      <Button type="submit" disabled={pending}>{pending ? "Saving" : mode === "create" ? "Create client" : "Save profile"}</Button>
    </form>
  );
}

export function WebsiteForm({ clientId, values }: { clientId: string; values?: { id: string; name: string; url: string | null; platform: string; environment: string; status: string; notes: string | null } }) {
  const [state, action, pending] = useActionState(saveWebsiteAction, null);
  const err = (f: string) => (state && !state.ok && state.field === f ? state.error : null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="clientId" value={clientId} />
      {values && <input type="hidden" name="websiteId" value={values.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor={`w-name-${values?.id ?? "new"}`} required>
          <Input id={`w-name-${values?.id ?? "new"}`} name="name" defaultValue={values?.name ?? ""} required maxLength={120} />
        </Field>
        <Field label="URL" htmlFor={`w-url-${values?.id ?? "new"}`} error={err("url")}>
          <Input id={`w-url-${values?.id ?? "new"}`} name="url" type="url" defaultValue={values?.url ?? ""} placeholder="https://" />
        </Field>
        <Field label="Platform" htmlFor={`w-platform-${values?.id ?? "new"}`} hint="For example Wix, WordPress, Next.js on Vercel.">
          <Input id={`w-platform-${values?.id ?? "new"}`} name="platform" defaultValue={values?.platform ?? ""} maxLength={60} />
        </Field>
        <Field label="Environment" htmlFor={`w-env-${values?.id ?? "new"}`}>
          <Select id={`w-env-${values?.id ?? "new"}`} name="environment" defaultValue={values?.environment ?? "production"}>
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="development">Development</option>
          </Select>
        </Field>
        {values && (
          <Field label="Status" htmlFor={`w-status-${values.id}`}>
            <Select id={`w-status-${values.id}`} name="status" defaultValue={values.status}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
        )}
      </div>
      <Field label="Notes" htmlFor={`w-notes-${values?.id ?? "new"}`}>
        <Textarea id={`w-notes-${values?.id ?? "new"}`} name="notes" defaultValue={values?.notes ?? ""} maxLength={2000} />
      </Field>
      <FormError state={state} />
      <Button type="submit" variant={values ? "secondary" : "primary"} size="sm" disabled={pending}>{pending ? "Saving" : values ? "Save website" : "Add website"}</Button>
    </form>
  );
}

export function ReferenceForm({ clientId, values }: { clientId: string; values?: { id: string; kind: string; label: string; external_identifier: string | null; url: string | null; vault_reference: string | null; notes: string | null; active: boolean } }) {
  const [state, action, pending] = useActionState(saveReferenceAction, null);
  const err = (f: string) => (state && !state.ok && state.field === f ? state.error : null);
  const k = values?.id ?? "new";
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="clientId" value={clientId} />
      {values && <input type="hidden" name="referenceId" value={values.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kind" htmlFor={`r-kind-${k}`}>
          <Select id={`r-kind-${k}`} name="kind" defaultValue={values?.kind ?? "other"}>
            {ACCOUNT_REFERENCE_KINDS.map((kind) => (
              <option key={kind} value={kind}>{label(kind)}</option>
            ))}
          </Select>
        </Field>
        <Field label="Label" htmlFor={`r-label-${k}`} required error={err("label")}>
          <Input id={`r-label-${k}`} name="label" defaultValue={values?.label ?? ""} required maxLength={120} />
        </Field>
        <Field label="Identifier" htmlFor={`r-ext-${k}`} hint="Account or property ID as given by the client. Never a password.">
          <Input id={`r-ext-${k}`} name="externalIdentifier" defaultValue={values?.external_identifier ?? ""} maxLength={120} />
        </Field>
        <Field label="Link" htmlFor={`r-url-${k}`} error={err("url")}>
          <Input id={`r-url-${k}`} name="url" type="url" defaultValue={values?.url ?? ""} placeholder="https://" />
        </Field>
        <Field label="Vault reference" htmlFor={`r-vault-${k}`} hint="Where the credential lives, for example vault://clinic-genie/client/ga4.">
          <Input id={`r-vault-${k}`} name="vaultReference" defaultValue={values?.vault_reference ?? ""} maxLength={200} />
        </Field>
      </div>
      <Field label="Notes" htmlFor={`r-notes-${k}`}>
        <Textarea id={`r-notes-${k}`} name="notes" defaultValue={values?.notes ?? ""} maxLength={2000} />
      </Field>
      {values && <Checkbox name="deactivate" label="Deactivate this reference" defaultChecked={!values.active} />}
      <FormError state={state} />
      <Button type="submit" variant={values ? "secondary" : "primary"} size="sm" disabled={pending}>{pending ? "Saving" : values ? "Save reference" : "Add reference"}</Button>
    </form>
  );
}
