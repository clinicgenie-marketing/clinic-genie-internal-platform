import Link from "next/link";
import { notFound } from "next/navigation";
import { canEditClient, canReviewClient, formatDateTime, getApproval, relatedHref } from "@clinic-genie/db";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { PageHeader, Card, CardHeader, KeyValue } from "@/components/ui/Card";
import { Badge, APPROVAL_TONE, label } from "@/components/ui/Badge";
import { ApprovalForm, DecisionForm, WorkflowButton } from "@/components/modules/ApprovalForms";
import { RelatedPicker } from "@/components/modules/RelatedPicker";
import { Notice } from "@/components/ui/Notice";

export const dynamic = "force-dynamic";

export default async function ApprovalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ relatedType?: string; edit?: string }> }) {
  const access = await requireAccess();
  const { id } = await params;
  const { relatedType, edit } = await searchParams;
  const data = await staffTx(access, async (db) => {
    const approval = await getApproval(db, id);
    if (!approval) return null;
    const picker = await RelatedPicker({ db, clientId: approval.client_id, relatedType: relatedType ?? approval.related_type, relatedId: approval.related_id, refineHref: (t) => `/approvals/${id}?edit=1&relatedType=${t}` });
    return { approval, picker };
  });
  if (!data) notFound();
  const { approval: a, picker } = data;
  const canEdit = canEditClient(access, a.client_id);
  const canDecide = canReviewClient(access, a.client_id) && a.requested_by !== access.user.id;
  const editable = canEdit && (a.status === "draft" || a.status === "changes_requested");
  const decided = a.status === "approved" || a.status === "changes_requested";
  const related = relatedHref(a.related_type, a.related_id);
  return (
    <>
      <PageHeader eyebrow={<Link href={`/clients/${a.client_id}`} className="hover:underline">{a.client_name}</Link>} title={a.title} description={<span className="flex flex-wrap gap-2 items-center"><Badge tone={APPROVAL_TONE[a.status]}>{label(a.status)}</Badge><Badge>{label(a.request_type)}</Badge></span>} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="p-5">
            <KeyValue items={[
              { label: "Requested by", value: a.requester_name },
              { label: "Submitted", value: a.submitted_at ? formatDateTime(a.submitted_at) : null },
              { label: "Related record", value: a.related_type ? (related ? <Link href={related} className="text-action hover:underline">{label(a.related_type)}</Link> : label(a.related_type)) : null },
              { label: "Withdrawn", value: a.withdrawn_at ? formatDateTime(a.withdrawn_at) : null },
            ]} />
            {a.summary && <p className="text-sm mt-4 whitespace-pre-wrap">{a.summary}</p>}
            {editable && !edit && <Link href={`/approvals/${id}?edit=1`} className="text-sm text-action hover:underline mt-4 inline-block">Edit request</Link>}
          </Card>
          {editable && edit && (
            <Card>
              <CardHeader title="Edit request" action={<Link href={`/approvals/${id}`} className="text-sm text-action hover:underline">Close editor</Link>} />
              <div className="px-5 pb-5"><ApprovalForm mode="edit" values={{ approvalId: a.id, clientId: a.client_id, title: a.title, summary: a.summary, requestType: a.request_type }} relatedPicker={picker} /></div>
            </Card>
          )}
          <Card>
            <CardHeader title="Decision history" description="Append-only. Superseded decisions remain visible." />
            <ol className="divide-y divide-line">
              {a.decisions.length === 0 && <li className="px-5 py-3 text-sm text-muted">No decision yet.</li>}
              {a.decisions.map((d) => (
                <li key={d.id} className="px-5 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={d.outcome === "approved" ? "good" : "bad"}>{label(d.outcome)}</Badge>
                    {d.superseded_at && <Badge tone="neutral">Superseded {formatDateTime(d.superseded_at)}</Badge>}
                    {d.supersedes_decision_id && <span className="text-xs text-muted">Revises an earlier decision</span>}
                  </div>
                  {d.note && <div className="mt-1 whitespace-pre-wrap">{d.note}</div>}
                  <div className="text-xs text-muted mt-1">{d.decider_name}, {formatDateTime(d.decided_at)}</div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <div className="space-y-6">
          {canEdit && (a.status === "draft" || a.status === "changes_requested" || a.status === "submitted") && (
            <Card className="p-5 space-y-3">
              <h2 className="text-base font-semibold">Request actions</h2>
              <div className="flex flex-wrap gap-2">
                {(a.status === "draft" || a.status === "changes_requested") && <WorkflowButton approvalId={a.id} op="submit" variant="primary">Submit for decision</WorkflowButton>}
                <WorkflowButton approvalId={a.id} op="withdraw" variant="danger">Withdraw</WorkflowButton>
              </div>
            </Card>
          )}
          {(a.status === "submitted" || decided) && (
            <Card>
              <CardHeader title={decided ? "Revise decision" : "Decide"} description={decided ? "Creates a new decision linked to the current one." : "Only admins, managers or reviewers with access to this client can decide."} />
              <div className="px-5 pb-5">
                {canDecide ? <DecisionForm approvalId={a.id} revising={decided} /> : <Notice tone="neutral">{a.requested_by === access.user.id ? "You requested this approval, so someone else must decide it." : "You are not authorised to decide this request."}</Notice>}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
