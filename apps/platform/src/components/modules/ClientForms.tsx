"use client";

import { useActionState, useState } from "react";
import { ACCOUNT_REFERENCE_KINDS, CLIENT_CHANNELS } from "@clinic-genie/contracts";
import { createClientAction, saveReferenceAction, saveWebsiteAction, updateClientAction } from "@/app/actions/clients";
import type { ActionState } from "@/lib/actions";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/Field";
import { label } from "@/components/ui/Badge";

type Staff = Array<{ id: string; display_name: string }>;

function banner(state: ActionState): ActionState {
  if (state && !state.ok && state.field) return null;
  return state;
}

function describedBy(id: string, error: string | null, hint = false) {
  return {
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  };
}

export function ClientForm({ mode, staff, values }: { mode: "create" | "edit"; staff: Staff; values: { clientId?: string; slug?: string; name?: string; ownerUserId?: string | null; channels?: string[]; notes?: string | null; isSynthetic?: boolean } }) {
  const [state, action, pending] = useActionState(mode === "create" ? createClientAction : updateClientAction, null);
  const [name, setName] = useState(values.name ?? "");
  const [slug, setSlug] = useState(values.slug ?? "");
  const [owner, setOwner] = useState(values.ownerUserId ?? "");
  const [channels, setChannels] = useState(values.channels ?? []);
  const [notes, setNotes] = useState(values.notes ?? "");
  const [synthetic, setSynthetic] = useState(Boolean(values.isSynthetic));
  const err = (f: string) => (state && !state.ok && state.field === f ? state.error : null);
  return (
    <form action={action} className="space-y-5">
      {values.clientId && <input type="hidden" name="clientId" value={values.clientId} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client name" htmlFor="name" required>
          <Input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
        </Field>
        {mode === "create" ? (
          <Field label="Identifier" htmlFor="slug" required hint="Lowercase, numbers and hyphens. Permanent." error={err("slug")}>
            <Input id="slug" name="slug" value={slug} onChange={(e) => setSlug(e.target.value)} required pattern="[a-z0-9][a-z0-9-]{1,62}" {...describedBy("slug", err("slug"), true)} />
          </Field>
        ) : (
          <Field label="Identifier" htmlFor="slug-ro" hint="Permanent. It does not change.">
            <Input id="slug-ro" value={values.slug ?? ""} readOnly aria-readonly="true" className="read-only:bg-surface-muted read-only:text-muted" />
          </Field>
        )}
      </div>
      <Field label="Accountable owner" htmlFor="ownerUserId" hint="The staff member answerable for this client.">
        <Select id="ownerUserId" name="ownerUserId" value={owner} onChange={(e) => setOwner(e.target.value)}>
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
            <Checkbox
              key={c}
              name="channels"
              value={c}
              checked={channels.includes(c)}
              onChange={(e) => setChannels((current) => e.target.checked ? [...current, c] : current.filter((item) => item !== c))}
              label={label(c)}
            />
          ))}
        </div>
      </fieldset>
      <Field label="Notes" htmlFor="notes">
        <Textarea id="notes" name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} />
      </Field>
      {mode === "create" && (
        <Checkbox name="isSynthetic" label="This is demonstration data (fictional client)" checked={synthetic} onChange={(e) => setSynthetic(e.target.checked)} />
      )}
      <FormError state={banner(state)} />
      <Button type="submit" disabled={pending} aria-busy={pending}>{pending ? "Saving…" : mode === "create" ? "Create client" : "Save profile"}</Button>
    </form>
  );
}

export function WebsiteForm({ clientId, values }: { clientId: string; values?: { id: string; name: string; url: string | null; platform: string; environment: string; status: string; notes: string | null } }) {
  const [state, action, pending] = useActionState(saveWebsiteAction, null);
  const [name, setName] = useState(values?.name ?? "");
  const [url, setUrl] = useState(values?.url ?? "");
  const [platform, setPlatform] = useState(values?.platform ?? "");
  const [environment, setEnvironment] = useState(values?.environment ?? "production");
  const [status, setStatus] = useState(values?.status ?? "active");
  const [notes, setNotes] = useState(values?.notes ?? "");
  const err = (f: string) => (state && !state.ok && state.field === f ? state.error : null);
  const id = values?.id ?? "new";
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="clientId" value={clientId} />
      {values && <input type="hidden" name="websiteId" value={values.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor={`w-name-${id}`} required>
          <Input id={`w-name-${id}`} name="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
        </Field>
        <Field label="URL" htmlFor={`w-url-${id}`} error={err("url")}>
          <Input id={`w-url-${id}`} name="url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" {...describedBy(`w-url-${id}`, err("url"))} />
        </Field>
        <Field label="Platform" htmlFor={`w-platform-${id}`} hint="For example Wix, WordPress, Next.js on Vercel.">
          <Input id={`w-platform-${id}`} name="platform" value={platform} onChange={(e) => setPlatform(e.target.value)} maxLength={60} />
        </Field>
        <Field label="Environment" htmlFor={`w-env-${id}`}>
          <Select id={`w-env-${id}`} name="environment" value={environment} onChange={(e) => setEnvironment(e.target.value)}>
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="development">Development</option>
          </Select>
        </Field>
        {values && (
          <Field label="Status" htmlFor={`w-status-${id}`}>
            <Select id={`w-status-${id}`} name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
        )}
      </div>
      <Field label="Notes" htmlFor={`w-notes-${id}`}>
        <Textarea id={`w-notes-${id}`} name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
      </Field>
      <FormError state={banner(state)} />
      <Button type="submit" variant={values ? "secondary" : "primary"} size="sm" disabled={pending} aria-busy={pending}>{pending ? "Saving…" : values ? "Save website" : "Add website"}</Button>
    </form>
  );
}

export function ReferenceForm({ clientId, values }: { clientId: string; values?: { id: string; kind: string; label: string; external_identifier: string | null; url: string | null; vault_reference: string | null; notes: string | null; active: boolean } }) {
  const [state, action, pending] = useActionState(saveReferenceAction, null);
  const [kind, setKind] = useState(values?.kind ?? "other");
  const [refLabel, setRefLabel] = useState(values?.label ?? "");
  const [externalId, setExternalId] = useState(values?.external_identifier ?? "");
  const [url, setUrl] = useState(values?.url ?? "");
  const [vault, setVault] = useState(values?.vault_reference ?? "");
  const [notes, setNotes] = useState(values?.notes ?? "");
  const [deactivate, setDeactivate] = useState(values ? !values.active : false);
  const err = (f: string) => (state && !state.ok && state.field === f ? state.error : null);
  const k = values?.id ?? "new";
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="clientId" value={clientId} />
      {values && <input type="hidden" name="referenceId" value={values.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kind" htmlFor={`r-kind-${k}`}>
          <Select id={`r-kind-${k}`} name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            {ACCOUNT_REFERENCE_KINDS.map((item) => (
              <option key={item} value={item}>{label(item)}</option>
            ))}
          </Select>
        </Field>
        <Field label="Label" htmlFor={`r-label-${k}`} required error={err("label")}>
          <Input id={`r-label-${k}`} name="label" value={refLabel} onChange={(e) => setRefLabel(e.target.value)} required maxLength={120} {...describedBy(`r-label-${k}`, err("label"))} />
        </Field>
        <Field label="Identifier" htmlFor={`r-ext-${k}`} hint="Account or property ID as given by the client. Never a password.">
          <Input id={`r-ext-${k}`} name="externalIdentifier" value={externalId} onChange={(e) => setExternalId(e.target.value)} maxLength={120} />
        </Field>
        <Field label="Link" htmlFor={`r-url-${k}`} error={err("url")}>
          <Input id={`r-url-${k}`} name="url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" {...describedBy(`r-url-${k}`, err("url"))} />
        </Field>
        <Field label="Vault reference" htmlFor={`r-vault-${k}`} hint="Where the credential lives, for example vault://clinic-genie/client/ga4.">
          <Input id={`r-vault-${k}`} name="vaultReference" value={vault} onChange={(e) => setVault(e.target.value)} maxLength={200} />
        </Field>
      </div>
      <Field label="Notes" htmlFor={`r-notes-${k}`}>
        <Textarea id={`r-notes-${k}`} name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
      </Field>
      {values && (
        <Checkbox name="deactivate" label="Deactivate this reference" checked={deactivate} onChange={(e) => setDeactivate(e.target.checked)} />
      )}
      <FormError state={banner(state)} />
      <Button type="submit" variant={values ? "secondary" : "primary"} size="sm" disabled={pending} aria-busy={pending}>{pending ? "Saving…" : values ? "Save reference" : "Add reference"}</Button>
    </form>
  );
}
