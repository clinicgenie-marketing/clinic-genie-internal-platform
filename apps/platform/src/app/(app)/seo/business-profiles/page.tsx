import { canEditClient, listClients, listSeoBusinessProfiles } from "@clinic-genie/db";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { PageHeader, Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Notice";
import { SeoBusinessProfileForm } from "@/components/modules/SeoSoftLaunchForms";
import { SeoSubnav } from "@/components/modules/SeoSubnav";
import { Field, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge, label } from "@/components/ui/Badge";
import { clientLabel } from "@/lib/client-label";

export const dynamic = "force-dynamic";
export const metadata = { title: "Google Business Profile" };

export default async function SeoBusinessProfilesPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const access = await requireAccess();
  const { client } = await searchParams;
  const data = await staffTx(access, async (db) => {
    const clients = (await listClients(db)).filter((item) => canEditClient(access, item.id));
    const selected = clients.find((item) => item.id === client);
    const profiles = selected ? await listSeoBusinessProfiles(db, selected.id) : [];
    return { clients, selected, profiles };
  });

  return (
    <>
      <PageHeader title="Google Business Profile" description="Keep a branch-level profile reference and honest setup status. This is not a direct Google integration." />
      <SeoSubnav pathname="/seo/business-profiles" />
      <Card className="mb-6 p-5">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <Field label="Client" htmlFor="client" required>
            <Select id="client" name="client" defaultValue={client ?? ""} required>
              <option value="" disabled>Choose client</option>
              {data.clients.map((item) => <option key={item.id} value={item.id}>{clientLabel(item)}</option>)}
            </Select>
          </Field>
          <Button type="submit" variant="secondary" size="sm">Open branch profiles</Button>
        </form>
      </Card>
      {!data.selected ? (
        <EmptyState title="Choose a client">Branch profile references are scoped to a client.</EmptyState>
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader title={`${clientLabel(data.selected)} · Add a branch`} description="A staff-marked status is not independently verified by Google." />
            <div className="px-5 pb-5"><SeoBusinessProfileForm clientId={data.selected.id} /></div>
          </Card>
          <Card>
            <CardHeader title="Branch references" description="Open the saved profile, or open Google's Business Profile manager." />
            {data.profiles.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">No branch profiles recorded yet.</p>
            ) : (
              <div className="space-y-4 px-5 pb-5">
                {data.profiles.map((profile) => (
                  <section key={profile.id} className="rounded-xl border border-line p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{profile.branch_name}</h3>
                      <Badge tone={profile.setup_status === "staff_marked_verified" ? "good" : profile.setup_status === "in_progress" ? "warn" : "neutral"}>{label(profile.setup_status)}</Badge>
                    </div>
                    <SeoBusinessProfileForm clientId={profile.client_id} profile={profile} />
                  </section>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
