"use client";

import { useActionState } from "react";
import { saveFormRouteAction, testSubmissionAction } from "@/app/actions/forms";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Select, Textarea } from "@/components/ui/Field";

export function FormRouteCard({
  clientId,
  contacts,
  recipientContactId,
  confirmationMessage,
  canSave,
  canTest,
}: {
  clientId: string;
  contacts: Array<{ id: string; name: string; email: string | null }>;
  recipientContactId: string | null;
  confirmationMessage: string | null;
  canSave: boolean;
  canTest: boolean;
}) {
  const [saved, save, saving] = useActionState(saveFormRouteAction, null);
  const [tested, test, testing] = useActionState(testSubmissionAction, null);
  const recipient = contacts.find((contact) => contact.id === recipientContactId);
  return (
    <div className="space-y-4">
      {canSave ? (
        <form action={save} className="space-y-4">
          <input type="hidden" name="clientId" value={clientId} />
          <Field label="Approved recipient" htmlFor={`recipient-${clientId}`} hint={contacts.length === 0 ? "Add a contact on the client profile before choosing a recipient." : "The address is the contact’s work email."}>
            <Select id={`recipient-${clientId}`} name="recipientContactId" defaultValue={recipientContactId ?? ""}>
              <option value="">No recipient chosen</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>{contact.name}{contact.email ? ` · ${contact.email}` : ""}</option>
              ))}
            </Select>
          </Field>
          <Field label="Confirmation wording" htmlFor={`message-${clientId}`} hint="Approved wording kept here. The clinic website sends its own message until this wording is applied there.">
            <Textarea id={`message-${clientId}`} name="confirmationMessage" defaultValue={confirmationMessage ?? ""} maxLength={1000} />
          </Field>
          <FormError state={saved} />
          <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : "Save routing"}</Button>
        </form>
      ) : (
        <div className="space-y-2 text-sm">
          <p><span className="font-medium">Approved recipient. </span>{recipient ? `${recipient.name}${recipient.email ? ` · ${recipient.email}` : ""}` : "No recipient chosen."}</p>
          <p className="whitespace-pre-wrap"><span className="font-medium">Confirmation wording. </span>{confirmationMessage || "None saved."}</p>
        </div>
      )}
      {canTest && (
        <form action={test} className="space-y-2 border-t border-line pt-4">
          <input type="hidden" name="clientId" value={clientId} />
          <p className="text-sm text-ink-soft">A test submission stores one demonstration enquiry. It does not contact a patient.</p>
          <FormError state={tested} />
          <Button type="submit" variant="secondary" size="sm" disabled={testing}>{testing ? "Sending…" : "Test submission"}</Button>
        </form>
      )}
    </div>
  );
}
