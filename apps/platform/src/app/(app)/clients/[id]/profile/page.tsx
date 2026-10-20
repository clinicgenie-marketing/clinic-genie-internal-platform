import { canEditClient, canManageRegistry, getClient, listAccountReferences, listActiveStaff, listMemberships, listStaff, listWebsites } from "@clinic-genie/db";
import { requireClientAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/Card";
import { ClientForm, ReferenceForm, WebsiteForm } from "@/components/modules/ClientForms";
import { archiveClientAction, membershipAction } from "@/app/actions/clients";
import { Button } from "@/components/ui/Button";
import { Badge, label } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { Select } from "@/components/ui/Field";

export const dynamic = "force-dynamic";

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireClientAccess(id);
  const data = await staffTx(access, async (db) => ({
    client: (await getClient(db, id))!,
    websites: await listWebsites(db, id),
    refs: await listAccountReferences(db, id, true),
    members: await listMemberships(db, id),
    staff: await listActiveStaff(db),
    allStaff: access.user.platform_role === "admin" ? await listStaff(db) : [],
  }));
  const manage = canManageRegistry(access);
  const edit = canEditClient(access, id);
  const isAdmin = access.user.platform_role === "admin";
  const nonMembers = data.allStaff.filter((s) => s.active && !data.members.some((m) => m.user_id === s.id));
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader title="Client profile" description="Accountable owner, channels and notes." />
        <div className="px-5 pb-5">
          {manage ? <ClientForm mode="edit" staff={data.staff} values={{ clientId: id, slug: data.client.slug, name: data.client.name, ownerUserId: data.client.owner_user_id, channels: data.client.channels, notes: data.client.notes }} /> : <Notice tone="neutral">Only admins and managers can edit the profile.</Notice>}
          {manage && (
            <form action={archiveClientAction} className="mt-6 border-t border-line pt-4">
              <input type="hidden" name="clientId" value={id} />
              {data.client.status === "active" ? (
                <>
                  <p className="text-sm text-muted mb-2">Archiving hides the client from active lists. Every task, decision and record is kept.</p>
                  <Button type="submit" variant="danger" size="sm">Archive client</Button>
                </>
              ) : (
                <>
                  <input type="hidden" name="restore" value="1" />
                  <Button type="submit" variant="secondary" size="sm">Restore client</Button>
                </>
              )}
            </form>
          )}
        </div>
      </Card>
      <Card>
        <CardHeader title="Staff access" description="Admins and managers see every client. Others need a membership here." />
        <div className="px-5 pb-5 space-y-3">
          <ul className="divide-y divide-line text-sm">
            {data.members.map((m) => (
              <li key={m.id} className="py-2 flex items-center justify-between gap-3">
                <span>{m.user_name} <Badge>{label(m.user_role)}</Badge> <span className="text-muted text-xs">{m.user_email}</span></span>
                {isAdmin && (
                  <form action={membershipAction}>
                    <input type="hidden" name="clientId" value={id} />
                    <input type="hidden" name="membershipId" value={m.id} />
                    <Button type="submit" variant="ghost" size="sm">Revoke</Button>
                  </form>
                )}
              </li>
            ))}
            {data.members.length === 0 && <li className="py-2 text-muted">No memberships.</li>}
          </ul>
          {isAdmin && nonMembers.length > 0 && (
            <form key={data.members.map((m) => m.id).join(",")} action={membershipAction} className="flex items-end gap-2">
              <input type="hidden" name="clientId" value={id} />
              <label className="text-sm flex-1">
                <span className="block text-xs font-medium mb-1">Grant access to</span>
                <Select name="userId" defaultValue="">
                  <option value="" disabled>Choose staff</option>
                  {nonMembers.map((s) => (
                    <option key={s.id} value={s.id}>{s.display_name} ({label(s.platform_role)})</option>
                  ))}
                </Select>
              </label>
              <Button type="submit" variant="secondary" size="sm">Grant</Button>
            </form>
          )}
        </div>
      </Card>
      <Card>
        <CardHeader title="Websites" />
        <div className="px-5 pb-5 space-y-6">
          {data.websites.length === 0 && <p className="text-sm text-muted">{edit ? "No websites recorded yet. Add a placeholder address below, not a real clinic URL." : "No websites recorded."}</p>}
          {data.websites.map((w) => (
            <div key={w.id} className="border-b border-line pb-5">
              {edit ? <WebsiteForm clientId={id} values={w} /> : <p className="text-sm">{w.name} {w.url}</p>}
            </div>
          ))}
          {edit && <div><h3 className="text-sm font-semibold mb-2">Add a website</h3><WebsiteForm key={data.websites.map((w) => w.id).join(",") || "none"} clientId={id} /></div>}
        </div>
      </Card>
      <Card>
        <CardHeader title="Account references" description="A reference is a saved link and identifier, never a password. Values that look like credentials are refused." />
        <div className="px-5 pb-5 space-y-6">
          {data.refs.length === 0 && <p className="text-sm text-muted">{edit ? "No account references recorded yet. Save a link and an identifier, never a password." : "No account references recorded."}</p>}
          {data.refs.map((r) => (
            <div key={r.id} className={`border-b border-line pb-5 ${r.active ? "" : "opacity-70"}`}>
              {edit ? <ReferenceForm clientId={id} values={r} /> : <p className="text-sm">{label(r.kind)}: {r.label}</p>}
            </div>
          ))}
          {edit && <div><h3 className="text-sm font-semibold mb-2">Add a reference</h3><ReferenceForm key={data.refs.map((r) => r.id).join(",") || "none"} clientId={id} /></div>}
        </div>
      </Card>
    </div>
  );
}
