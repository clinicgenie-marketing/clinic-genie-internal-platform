import Link from "next/link";
import { notFound } from "next/navigation";
import { canEditClient, formatDate, getAdsChange } from "@clinic-genie/db";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { PageHeader, Card, CardHeader, KeyValue } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { VerifyAdsChangeForm } from "@/components/modules/AdsForms";

export const dynamic = "force-dynamic";

export default async function AdsChangePage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireAccess();
  const { id } = await params;
  const c = await staffTx(access, (db) => getAdsChange(db, id));
  if (!c) notFound();
  const canEdit = canEditClient(access, c.client_id);
  return (
    <>
      <PageHeader eyebrow={<Link href={`/clients/${c.client_id}/google-ads`} className="hover:underline">{c.client_name}</Link>} title={c.description} description={c.verification_on ? <Badge tone="good">Verified {formatDate(c.verification_on)}</Badge> : <Badge tone="warn">Not yet verified</Badge>} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <KeyValue items={[
            { label: "Where", value: c.scope },
            { label: "Implemented on", value: formatDate(c.implemented_on) },
            { label: "Responsible", value: c.responsible_name },
            { label: "Reason", value: c.reason },
            { label: "Audit", value: c.audit_id ? <Link href={`/google-ads/audits/${c.audit_id}`} className="text-action hover:underline">{c.audit_title}</Link> : null },
            { label: "Finding addressed", value: c.finding_text },
            { label: "Approval reference", value: c.approval_id ? <Link href={`/approvals/${c.approval_id}`} className="text-action hover:underline">{c.approval_title}</Link> : null },
            { label: "Verified by", value: c.verified_by_name },
          ]} />
          <div className="grid gap-2 sm:grid-cols-2 mt-4 text-sm">
            <div className="rounded-md bg-surface-muted p-3"><div className="text-xs text-muted">Before</div>{c.before_value ?? <span className="text-muted">Not recorded</span>}</div>
            <div className="rounded-md bg-surface-muted p-3"><div className="text-xs text-muted">After</div>{c.after_value ?? <span className="text-muted">Not recorded</span>}</div>
          </div>
          {c.outcome_note && <div className="mt-4 text-sm"><div className="text-xs font-semibold uppercase tracking-wide text-muted">Observed afterwards</div><p className="mt-1 whitespace-pre-wrap">{c.outcome_note}</p></div>}
        </Card>
        <div>{canEdit && !c.verification_on && <Card><CardHeader title="Verify this change" /><div className="px-5 pb-5"><VerifyAdsChangeForm changeId={id} /></div></Card>}</div>
      </div>
    </>
  );
}
