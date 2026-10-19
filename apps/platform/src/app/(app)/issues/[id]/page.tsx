import Link from "next/link";
import { notFound } from "next/navigation";
import { canEditClient, formatDateTime, getIssue, listActiveStaff, relatedHref } from "@clinic-genie/db";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { PageHeader, Card, CardHeader, KeyValue } from "@/components/ui/Card";
import { Badge, ISSUE_TONE, SEVERITY_TONE, label } from "@/components/ui/Badge";
import { EvidenceForm, IssueForm, IssueTransitionForm } from "@/components/modules/IssueForms";
import { RelatedPicker } from "@/components/modules/RelatedPicker";
import { removeEvidenceAction } from "@/app/actions/issues";

export const dynamic = "force-dynamic";

export default async function IssuePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ relatedType?: string; edit?: string }> }) {
  const access = await requireAccess();
  const { id } = await params;
  const { relatedType, edit } = await searchParams;
  const data = await staffTx(access, async (db) => {
    const issue = await getIssue(db, id);
    if (!issue) return null;
    const owners = (await listActiveStaff(db)).filter((o) => o.platform_role !== "read_only");
    const picker = await RelatedPicker({ db, clientId: issue.client_id, relatedType: relatedType ?? issue.related_type, relatedId: issue.related_id, refineHref: (t) => `/issues/${id}?edit=1&relatedType=${t}` });
    return { issue, owners, picker };
  });
  if (!data) notFound();
  const { issue, owners, picker } = data;
  const canEdit = canEditClient(access, issue.client_id);
  const isReviewer = access.user.platform_role === "reviewer" && access.memberships.some((m) => m.client_id === issue.client_id);
  const canTransition = canEdit || isReviewer;
  const related = relatedHref(issue.related_type, issue.related_id);
  return (
    <>
      <PageHeader eyebrow={<Link href={`/clients/${issue.client_id}/issues`} className="hover:underline">{issue.client_name}</Link>} title={issue.title} description={<span className="flex flex-wrap gap-2 items-center"><Badge tone={ISSUE_TONE[issue.status]}>{label(issue.status)}</Badge><Badge tone={SEVERITY_TONE[issue.severity]}>{label(issue.severity)}</Badge>{issue.reopen_count > 0 && <Badge tone="neutral">Reopened {issue.reopen_count}×</Badge>}</span>} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="p-5">
            <KeyValue items={[
              { label: "Owner", value: issue.owner_name },
              { label: "Opened", value: `${formatDateTime(issue.opened_at)} by ${issue.opened_by_name}` },
              { label: "Related record", value: issue.related_type ? (related ? <Link href={related} className="text-action hover:underline">{label(issue.related_type)}</Link> : label(issue.related_type)) : null },
              { label: "Resolved", value: issue.resolved_at ? `${formatDateTime(issue.resolved_at)} by ${issue.resolved_by_name}` : null },
              { label: "Verified", value: issue.verified_at ? `${label(issue.verification_result ?? "")} on ${formatDateTime(issue.verified_at)} by ${issue.verified_by_name}` : null },
            ]} />
            {issue.description && <p className="text-sm mt-4 whitespace-pre-wrap">{issue.description}</p>}
            {issue.resolution_note && <div className="mt-4 text-sm"><div className="text-xs font-semibold uppercase tracking-wide text-muted">Resolution</div><p className="mt-1 whitespace-pre-wrap">{issue.resolution_note}</p></div>}
            {canEdit && issue.status !== "verified_closed" && <Link href={edit ? `/issues/${id}` : `/issues/${id}?edit=1`} className="text-sm text-action hover:underline mt-4 inline-block">{edit ? "Close editor" : "Edit issue"}</Link>}
          </Card>
          {canEdit && edit && issue.status !== "verified_closed" && <Card className="p-5"><IssueForm mode="edit" values={{ issueId: issue.id, clientId: issue.client_id, title: issue.title, description: issue.description, severity: issue.severity, ownerUserId: issue.owner_user_id }} owners={owners} relatedPicker={picker} /></Card>}
          <Card>
            <CardHeader title="Evidence" description="Uploads are private and served only to staff with access to this client." />
            <ul className="divide-y divide-line">
              {issue.evidence.length === 0 && <li className="px-5 py-3 text-sm text-muted">No evidence attached.</li>}
              {issue.evidence.map((e) => (
                <li key={e.id} className="px-5 py-3 text-sm flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {e.kind === "upload" ? <a href={`/api/evidence/${e.id}`} className="text-action hover:underline" target="_blank" rel="noreferrer">{e.label}</a> : <a href={e.url ?? "#"} className="text-action hover:underline" target="_blank" rel="noreferrer">{e.label}</a>}
                    <span className="text-xs text-muted ml-2">{e.kind === "upload" ? `${e.mime_type}, ${Math.round((e.size_bytes ?? 0) / 1024)} KB` : "link"} · {e.uploaded_by_name}, {formatDateTime(e.created_at)}</span>
                  </span>
                  {canEdit && <form action={removeEvidenceAction}><input type="hidden" name="evidenceId" value={e.id} /><input type="hidden" name="issueId" value={issue.id} /><button type="submit" className="text-xs text-muted hover:underline cursor-pointer">Remove</button></form>}
                </li>
              ))}
            </ul>
            {(canEdit || isReviewer) && <div className="px-5 pb-5"><EvidenceForm clientId={issue.client_id} issueId={issue.id} /></div>}
          </Card>
          <Card>
            <CardHeader title="History" />
            <ol className="divide-y divide-line">
              {issue.history.map((h: { id: string; from_status: string | null; to_status: string; actor_name: string; note: string | null; verification_result: string | null; created_at: Date }) => (
                <li key={h.id} className="px-5 py-3 text-sm">
                  <div>{h.from_status ? `${label(h.from_status)} to ${label(h.to_status)}` : label(h.to_status)} {h.verification_result && <Badge tone={h.verification_result === "passed" ? "good" : "bad"}>Verification {h.verification_result}</Badge>}</div>
                  {h.note && <div className="text-muted whitespace-pre-wrap">{h.note}</div>}
                  <div className="text-xs text-muted mt-0.5">{h.actor_name}, {formatDateTime(h.created_at)}</div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <div>{canTransition && <Card><CardHeader title="Change status" description="Verification records the verifier, date and result." /><div className="px-5 pb-5"><IssueTransitionForm issueId={issue.id} status={issue.status} /></div></Card>}</div>
      </div>
    </>
  );
}
