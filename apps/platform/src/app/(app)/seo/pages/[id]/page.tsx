import Link from "next/link";
import { notFound } from "next/navigation";
import { canEditClient, formatDate, getSeoPage, listActiveStaff, listApprovals, listWebsites, todaySgt } from "@clinic-genie/db";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { PageHeader, Card, CardHeader, KeyValue } from "@/components/ui/Card";
import { Badge, CONTENT_TONE, FLAG_TONE, label } from "@/components/ui/Badge";
import { SeoChangeForm, SeoPageForm, VerifyChangeForm } from "@/components/modules/SeoForms";
import { archivePageAction } from "@/app/actions/seo";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function SeoPageDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const access = await requireAccess();
  const { id } = await params;
  const { edit } = await searchParams;
  const data = await staffTx(access, async (db) => {
    const page = await getSeoPage(db, id);
    if (!page) return null;
    return { page, websites: await listWebsites(db, page.client_id), owners: await listActiveStaff(db), approvals: await listApprovals(db, { clientId: page.client_id, statuses: ["approved"] }) };
  });
  if (!data) notFound();
  const { page } = data;
  const today = todaySgt();
  const canEdit = canEditClient(access, page.client_id);
  return (
    <>
      <PageHeader eyebrow={<Link href={`/clients/${page.client_id}/seo`} className="hover:underline">{page.client_name}</Link>} title={page.page_path} description={<span className="flex flex-wrap gap-2 items-center"><Badge tone={CONTENT_TONE[page.content_status]}>{label(page.content_status)}</Badge>{page.mapping_flag !== "none" && <Badge tone={FLAG_TONE[page.mapping_flag]}>{label(page.mapping_flag)}</Badge>}{page.archived_at && <Badge>Archived</Badge>}</span>} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="p-5">
            <KeyValue items={[
              { label: "Page title", value: page.page_title },
              { label: "Website", value: page.website_name },
              { label: "Primary keyword", value: page.primary_keyword },
              { label: "Secondary keywords", value: page.secondary_keywords.join(", ") || null },
              { label: "Search intent", value: page.search_intent ? label(page.search_intent) : null },
              { label: "Owner", value: page.owner_name },
              { label: "Last reviewed", value: page.last_reviewed_on ? formatDate(page.last_reviewed_on) : null },
              { label: "Next review", value: page.next_review_on ? <>{formatDate(page.next_review_on)} {page.next_review_on < today && <Badge tone="warn">Due</Badge>}</> : null },
            ]} />
            {page.mapping_flag !== "none" && <p className="text-sm mt-4"><strong>Mapping problem:</strong> {page.flag_note}</p>}
            {page.notes && <p className="text-sm text-muted mt-3 whitespace-pre-wrap">{page.notes}</p>}
            {canEdit && !page.archived_at && (
              <div className="mt-4 flex flex-wrap gap-3 items-center">
                <Link href={edit ? `/seo/pages/${id}` : `/seo/pages/${id}?edit=1`} className="text-sm text-action hover:underline">{edit ? "Close editor" : "Edit mapping"}</Link>
                <form action={archivePageAction}><input type="hidden" name="pageId" value={id} /><Button type="submit" variant="ghost" size="sm">Archive page</Button></form>
              </div>
            )}
          </Card>
          {canEdit && edit && (
            <Card className="p-5"><SeoPageForm clientId={page.client_id} websites={data.websites} owners={data.owners.filter((o) => o.platform_role !== "read_only")} values={page as unknown as Record<string, unknown> & { id: string }} /></Card>
          )}
          <Card>
            <CardHeader title="Change records" description="Before and after values, the reason, who changed it and what was observed afterwards." />
            <ol className="divide-y divide-line">
              {page.changes.length === 0 && <li className="px-5 py-3 text-sm text-muted">No changes recorded.</li>}
              {page.changes.map((c) => (
                <li key={c.id} className="px-5 py-4 text-sm">
                  <div className="flex flex-wrap gap-2 items-center">
                    <Badge tone="info">{label(c.change_type)}</Badge>
                    <span>{formatDate(c.changed_on)} by {c.changed_by_name}</span>
                    {c.approval_id && <Link href={`/approvals/${c.approval_id}`} className="text-action hover:underline text-xs">Approval</Link>}
                    {c.verification_on ? <Badge tone="good">Verified {formatDate(c.verification_on)}</Badge> : <Badge tone="warn">Not yet verified</Badge>}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 mt-2">
                    <div className="rounded-md bg-surface-muted p-2"><div className="text-xs text-muted">Before</div>{c.before_value ?? <span className="text-muted">Not recorded</span>}</div>
                    <div className="rounded-md bg-surface-muted p-2"><div className="text-xs text-muted">After</div>{c.after_value ?? <span className="text-muted">Not recorded</span>}</div>
                  </div>
                  <div className="mt-2"><span className="text-muted">Reason:</span> {c.reason}</div>
                  {c.outcome_note && <div className="mt-1"><span className="text-muted">Observed afterwards ({c.verified_by_name}):</span> {c.outcome_note}</div>}
                  {canEdit && !c.verification_on && <VerifyChangeForm pageId={id} changeId={c.id} />}
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <div className="space-y-6">
          {canEdit && !page.archived_at && (
            <Card>
              <CardHeader title="Record a change" />
              <div className="px-5 pb-5"><SeoChangeForm pageId={id} approvals={data.approvals} /></div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
