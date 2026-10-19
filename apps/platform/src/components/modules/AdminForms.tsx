"use client";

import { useActionState } from "react";
import { PLATFORM_ROLES } from "@clinic-genie/contracts";
import { createStaffAction, updateStaffAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, FormError, Input, Select } from "@/components/ui/Field";
import { label } from "@/components/ui/Badge";

export function NewStaffForm() {
  const [state, action, pending] = useActionState(createStaffAction, null);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Work email" htmlFor="new-email" required><Input id="new-email" name="email" type="email" required /></Field>
        <Field label="Display name" htmlFor="new-name" required><Input id="new-name" name="displayName" required maxLength={120} /></Field>
        <Field label="Role" htmlFor="new-role" required><Select id="new-role" name="role" defaultValue="specialist">{PLATFORM_ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}</Select></Field>
      </div>
      <FormError state={state} />
      <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving" : "Add staff member"}</Button>
    </form>
  );
}

export function EditStaffForm({ user }: { user: { id: string; display_name: string; platform_role: string; active: boolean } }) {
  const [state, action, pending] = useActionState(updateStaffAction, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="userId" value={user.id} />
      <Field label="Name" htmlFor={`name-${user.id}`}><Input id={`name-${user.id}`} name="displayName" defaultValue={user.display_name} className="min-w-44" /></Field>
      <Field label="Role" htmlFor={`role-${user.id}`}><Select id={`role-${user.id}`} name="role" defaultValue={user.platform_role}>{PLATFORM_ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}</Select></Field>
      <Checkbox name="deactivate" label="Deactivated" defaultChecked={!user.active} />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>{pending ? "Saving" : "Save"}</Button>
      <div className="basis-full"><FormError state={state} /></div>
    </form>
  );
}
