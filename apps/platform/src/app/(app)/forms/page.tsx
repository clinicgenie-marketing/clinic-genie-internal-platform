import Link from "next/link";
import { canEditClient, canManageRegistry, listClientContacts, listClients, listFormRoutes } from "@clinic-genie/db";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { PageHeader, Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Notice";
import { FormRouteCard } from "@/components/modules/FormRouteCard";
import { clientLabel } from "@/lib/client-label";

export const dynamic = "force-dynamic";
export const metadata = { title: "Forms" };

export default async function FormsPage() {
  const access = await requireAccess();
  const manage = canManageRegistry(access);
  const data = await staffTx(access, async (db) => {
    const clients = await listClients(db);
    const visible = manage ? clients : clients.filter((client) => access.memberships.some((membership) => membership.client_id === client.id));
    const routes = await listFormRoutes(db, visible.map((client) => client.id));
    const contacts = new Map<string, Awaited<ReturnType<typeof listClientContacts>>>();
    for (const client of visible) contacts.set(client.id, await listClientContacts(db, client.id, true));
    return { visible, routes, contacts };
  });
  const routeByClient = new Map(data.routes.map((route) => [route.client_id, route]));
  return (
    <>
      <PageHeader title="Forms" description="Configuration for each clinic form. Enquiries are the requests that have been received." />
      <p className="mb-4 text-sm text-ink-soft">The clinic website still sends mail from its own configuration until the approved recipient and wording are applied there.</p>
      {data.visible.length === 0 && <EmptyState title="No clients">Form routing appears once a client is available to you.</EmptyState>}
      <div className="space-y-4">
        {data.visible.map((client) => {
          const route = routeByClient.get(client.id);
          const contacts = (data.contacts.get(client.id) ?? [])
            .filter((contact) => contact.active || contact.id === route?.recipient_contact_id)
            .map((contact) => ({ id: contact.id, name: contact.active ? contact.name : `${contact.name} (inactive)`, email: contact.work_email }));
          return (
            <Card key={client.id}>
              <CardHeader
                title={clientLabel(client)}
                description="Appointment enquiry"
                action={<Link href={`/clients/${client.id}/profile`} className="text-sm font-semibold text-action hover:underline">Client profile</Link>}
              />
              <div className="px-5 pb-5">
                <FormRouteCard
                  clientId={client.id}
                  contacts={contacts}
                  recipientContactId={route?.recipient_contact_id ?? null}
                  confirmationMessage={route?.confirmation_message ?? null}
                  canSave={manage}
                  canTest={canEditClient(access, client.id)}
                />
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
