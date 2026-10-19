import { canEditClient, listClients, listSeoChanges, listSeoPages, todaySgt, formatDate } from "@clinic-genie/db";
import { CONTENT_STATUSES } from "@clinic-genie/contracts";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { PageHeader, Card, CardHeader } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { FilterBar, FilterSelect } from "@/components/ui/Filters";
import { SeoPageTable } from "@/components/modules/SeoList";
import { label } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "SEO" };

export default async function SeoPage({ searchParams }: { searchParams: Promise<{ client?: string; status?: string; flagged?: string }> }) {
  const access = await requireAccess();
  const { client, status, flagged } = await searchParams;
  const today = todaySgt();
  const data = await staffTx(access, async (db) => ({
    pages: await listSeoPages(db, { clientId: client || undefined, contentStatus: status || undefined, flaggedOnly: flagged === "1" }),
    unverified: await listSeoChanges(db, { clientId: client || undefined, unverifiedOnly: true, limit: 20 }),
    clients: await listClients(db),
  }));
  const canCreate = data.clients.some((c) => canEditClient(access, c.id));
  return (
    <>
      <PageHeader title="SEO content and search mapping" description="Which page targets which search, its content status and review dates, with before and after change records." action={canCreate ? <LinkButton href="/seo/new">Map a page</LinkButton> : undefined} />
      <Notice tone="neutral">Mapping flags and statuses are entered by staff. The platform has not crawled or verified any site.</Notice>
      <div className="mt-4">
        <FilterBar>
          <FilterSelect name="client" label="Client" value={client} options={data.clients.map((c) => ({ value: c.id, label: c.name }))} />
          <FilterSelect name="status" label="Content status" value={status} options={CONTENT_STATUSES.map((s) => ({ value: s, label: label(s) }))} />
          <FilterSelect name="flagged" label="Mapping" value={flagged} allLabel="All pages" options={[{ value: "1", label: "Flagged only" }]} />
        </FilterBar>
      </div>
      <Card><SeoPageTable pages={data.pages} today={today} /></Card>
      <Card className="mt-6">
        <CardHeader title="Changes awaiting verification" description="Recorded changes with no verification date yet." />
        <ul className="divide-y divide-line">
          {data.unverified.length === 0 && <li className="px-5 py-3 text-sm text-muted">Every recorded change has been verified.</li>}
          {data.unverified.map((c) => (
            <li key={c.id} className="px-5 py-2.5 text-sm">
              <Link href={`/seo/pages/${c.seo_page_id}`} className="text-action hover:underline">{c.page_path}</Link>: {label(c.change_type)} on {formatDate(c.changed_on)} by {c.changed_by_name}
              <div className="text-xs text-muted">{c.reason}</div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
