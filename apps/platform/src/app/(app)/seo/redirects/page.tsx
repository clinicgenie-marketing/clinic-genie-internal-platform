import { canEditClient, listClients, listSeoRedirects, listWebsites } from "@clinic-genie/db";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { PageHeader, Card, CardHeader } from "@/components/ui/Card";
import { EmptyState, Notice } from "@/components/ui/Notice";
import { SeoRedirectForm } from "@/components/modules/SeoSoftLaunchForms";
import { SeoSubnav } from "@/components/modules/SeoSubnav";
import { Field, Select } from "@/components/ui/Field";
import { FilterInput } from "@/components/ui/Filters";
import { Button } from "@/components/ui/Button";
import { clientLabel } from "@/lib/client-label";

export const dynamic = "force-dynamic";
export const metadata = { title: "SEO 301 redirects" };

export default async function SeoRedirectsPage({ searchParams }: { searchParams: Promise<{ client?: string; website?: string; q?: string }> }) {
  const access = await requireAccess();
  const { client, website, q } = await searchParams;
  const data = await staffTx(access, async (db) => {
    const clients = (await listClients(db)).filter((item) => canEditClient(access, item.id));
    const sites = (await Promise.all(clients.map(async (item) => (await listWebsites(db, item.id))
      .filter((site) => site.status === "active")
      .filter((site) => site.platform.toLowerCase().includes("next"))
      .map((site) => ({ ...site, clientName: clientLabel(item) }))))).flat();
    const selected = sites.find((site) => site.id === website && site.client_id === client);
    const redirects = selected ? await listSeoRedirects(db, { clientId: selected.client_id, websiteId: selected.id, search: q, includeInactive: true }) : [];
    return { clients, sites, selected, redirects };
  });

  return (
    <>
      <PageHeader title="URL redirect manager" description="Create and edit individual permanent 301 redirects for supported, connected websites." />
      <SeoSubnav pathname="/seo/redirects" />
      <Notice tone="neutral">Only local paths are accepted. Self-redirects and redirect chains that loop are rejected. Redirect changes reach connected Next.js clinic sites through the published settings API; Wix and other external platforms are not edited.</Notice>
      <Card className="my-5 p-5">
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
          <FilterInput name="q" label="Search from/to paths" value={q} />
          <Button type="submit" variant="secondary" size="sm">Show redirects</Button>
        </form>
      </Card>
      {!data.selected ? (
        <EmptyState title={data.sites.length ? "Choose a supported website" : "No connected-platform websites"}>Individual redirects can be published only to active websites marked as Next.js. Wix and other external platforms are not assumed to be editable here.</EmptyState>
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader title={`Add a redirect for ${data.selected.name}`} description="The destination must be a path on the same website. New rules use HTTP 301." />
            <div className="px-5 pb-5"><SeoRedirectForm clientId={data.selected.client_id} websiteId={data.selected.id} /></div>
          </Card>
          <Card>
            <CardHeader title="Redirects" description={`${data.redirects.length} matching rules. Search matches either path.`} />
            {data.redirects.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">{q ? "No redirects match that search." : "No redirects configured for this website."}</p>
            ) : (
              <div className="space-y-3 px-5 pb-5">
                {data.redirects.map((rule) => (
                  <SeoRedirectForm key={rule.id} clientId={rule.client_id} websiteId={rule.website_id} redirect={rule} />
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
