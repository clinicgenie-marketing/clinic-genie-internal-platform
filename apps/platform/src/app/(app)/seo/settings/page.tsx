import { canEditClient, canManageRegistry, getGoogleSiteVerification, hasActiveSeoSiteToken, listClients, listSeoPageSettings, listWebsites } from "@clinic-genie/db";
import { requireAccess } from "@/lib/session";
import { staffTx, serviceTx } from "@/lib/db";
import { PageHeader, Card, CardHeader } from "@/components/ui/Card";
import { EmptyState, Notice } from "@/components/ui/Notice";
import { SeoSiteSettingsEditor } from "@/components/modules/SeoSoftLaunchForms";
import { SeoSubnav } from "@/components/modules/SeoSubnav";
import { Field, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { clientLabel } from "@/lib/client-label";

export const dynamic = "force-dynamic";
export const metadata = { title: "SEO page settings" };

export default async function SeoSettingsPage({ searchParams }: { searchParams: Promise<{ client?: string; website?: string }> }) {
  const access = await requireAccess();
  const { client, website } = await searchParams;
  const data = await staffTx(access, async (db) => {
    const clients = (await listClients(db)).filter((item) => canEditClient(access, item.id));
    const sites = (await Promise.all(clients.map(async (item) => (await listWebsites(db, item.id))
      .filter((site) => site.status === "active")
      .map((site) => ({ ...site, clientName: clientLabel(item) }))))).flat();
    const selected = sites.find((site) => site.id === website && site.client_id === client);
    if (!selected) return { clients, sites, selected: null, settings: [], verification: null, connected: false };
    const [settings, verification, connected] = await Promise.all([
      listSeoPageSettings(db, { websiteId: selected.id }),
      getGoogleSiteVerification(db, selected.id),
      serviceTx((serviceDb) => hasActiveSeoSiteToken(serviceDb, selected.id)),
    ]);
    return { clients, sites, selected, settings, verification, connected };
  });

  return (
    <>
      <PageHeader title="SEO page settings" description="Publish page titles, descriptions, canonical paths and indexability to a connected, code-managed clinic website." />
      <SeoSubnav pathname="/seo/settings" />
      <Card className="mb-6 p-5">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <Field label="Client" htmlFor="client">
            <Select id="client" name="client" defaultValue={client ?? ""}>
              <option value="">Choose client</option>
              {data.clients.map((item) => <option key={item.id} value={item.id}>{clientLabel(item)}</option>)}
            </Select>
          </Field>
          <Field label="Website" htmlFor="website">
            <Select id="website" name="website" defaultValue={website ?? ""} required>
              <option value="">Choose website</option>
              {data.sites.filter((site) => !client || site.client_id === client).map((site) => (
                <option key={site.id} value={site.id}>{site.clientName} · {site.name}</option>
              ))}
            </Select>
          </Field>
          <Button type="submit" variant="secondary" size="sm">Open website</Button>
        </form>
      </Card>
      {!data.selected ? (
        <EmptyState title={data.sites.length ? "Choose a website" : "No editable websites"}>
          Select an active website to configure published SEO output. External platforms may not accept changes from this module.
        </EmptyState>
      ) : (
        <Card>
          <CardHeader title={data.selected.name} description={`${data.selected.clientName} · ${data.selected.url ?? "Website URL not recorded"} · Platform: ${data.selected.platform}`} />
          <div className="px-5 pb-5">
            {data.selected.platform.toLowerCase().includes("next") ? (
              <SeoSiteSettingsEditor
                clientId={data.selected.client_id}
                website={data.selected}
                settings={data.settings}
                verificationToken={data.verification}
                connected={data.connected}
                canManageIntegration={canManageRegistry(access)}
              />
            ) : (
              <Notice tone="warn">This platform is not connected to the Clinic Genie published-settings API. Do not assume SEO changes made here will update this website. Wix and other external website platforms are not edited by this module.</Notice>
            )}
          </div>
        </Card>
      )}
    </>
  );
}
