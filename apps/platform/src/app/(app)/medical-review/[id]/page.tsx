import Link from "next/link";
import { notFound } from "next/navigation";
import { canEditClient, canReviewClient, formatDateTime, getClaim, isGlobal, listActiveStaff } from "@clinic-genie/db";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { PageHeader, Card, CardHeader, KeyValue } from "@/components/ui/Card";
import { Badge, CLAIM_TONE, label } from "@/components/ui/Badge";
import { AssignReviewForm, DecisionForm, SourceForm, WithdrawButton, WordingForm } from "@/components/modules/MedicalForms";
import { Notice } from "@/components/ui/Notice";

export const dynamic = "force-dynamic";

export default async function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireAccess();
  const { id } = await params;
  const data = await staffTx(access, async (db) => {
    const claim = await getClaim(db, id);
    if (!claim) return null;
    return { claim, reviewers: (await listActiveStaff(db)).filter((s) => ["reviewer", "manager", "admin"].includes(s.platform_role)) };
  });
  if (!data) notFound();
  const { claim } = data;
  const canEdit = canEditClient(access, claim.client_id);
  const canReview = canReviewClient(access, claim.client_id);
  const live = claim.status !== "withdrawn";
  return (
    <>
      <PageHeader eyebrow={<Link href={`/clients/${claim.client_id}/medical-review`} className="hover:underline">{claim.client_name}</Link>} title={claim.claim_summary} description={<span className="flex flex-wrap gap-2 items-center"><Badge tone={CLAIM_TONE[claim.status]}>{label(claim.status)}</Badge>{claim.location && <span className="text-muted">{claim.location}</span>}</span>} action={canEdit && live ? <WithdrawButton claimId={id} /> : undefined} />
      {claim.status === "approved" && <div className="mb-4"><Notice tone="info">Approved means an assigned reviewer accepted wording v{claim.current_version} with recorded sources. It is not regulatory certification.</Notice></div>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Current wording (v{claim.current_version})</div>
            <p className="mt-2 whitespace-pre-wrap">{claim.current_wording}</p>
            <KeyValue items={[{ label: "Sources recorded", value: claim.source_count }, { label: "Open reviews", value: claim.open_review_count }]} />
          </Card>
          <Card>
            <CardHeader title="Reviews" description="Decided reviews are immutable. When wording changes they are kept and marked superseded." />
            <ul className="divide-y divide-line">
              {claim.reviews.length === 0 && <li className="px-5 py-3 text-sm text-muted">No review assigned yet.</li>}
              {claim.reviews.map((r) => {
                const mine = r.reviewer_user_id === access.user.id || isGlobal(access);
                return (
                  <li key={r.id} className="px-5 py-3 text-sm">
                    <div className="flex flex-wrap gap-2 items-center">
                      <Badge tone={r.status === "decided" ? (r.decision === "approved" ? "good" : r.decision === "rejected" ? "bad" : "warn") : r.status === "superseded" ? "neutral" : "info"}>{r.status === "decided" || r.status === "superseded" ? label(r.decision ?? "") : label(r.status)}</Badge>
                      {r.status === "superseded" && <Badge tone="neutral">Superseded by newer wording</Badge>}
                      <span>wording v{r.wording_version}, reviewer {r.reviewer_name}</span>
                    </div>
                    <div className="text-xs text-muted mt-1">Assigned by {r.assigned_by_name}, {formatDateTime(r.assigned_at)}{r.decided_at && ` · decided ${formatDateTime(r.decided_at)}`}</div>
                    {r.decision_note && <p className="mt-1 whitespace-pre-wrap">{r.decision_note}</p>}
                    {(r.status === "assigned" || r.status === "in_progress") && canReview && mine && <DecisionForm claimId={id} reviewId={r.id} />}
                    {(r.status === "assigned" || r.status === "in_progress") && (!canReview || !mine) && <p className="text-xs text-muted mt-1">Waiting for {r.reviewer_name}.</p>}
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Sources" description="Approval requires at least one. Unsupported claims are never marked approved." />
            <ul className="divide-y divide-line">
              {claim.sources.length === 0 && <li className="px-5 py-3 text-sm text-warn">No sources recorded.</li>}
              {claim.sources.map((s) => (
                <li key={s.id} className="px-5 py-3 text-sm">
                  <Badge>{label(s.source_type)}</Badge> <span className="font-medium">{s.title}</span>
                  {s.citation && <div className="text-muted">{s.citation}</div>}
                  {s.url && <a href={s.url} className="text-action hover:underline break-all" target="_blank" rel="noreferrer">{s.url}</a>}
                  <div className="text-xs text-muted mt-0.5">Added by {s.added_by_name}, {formatDateTime(s.created_at)}</div>
                </li>
              ))}
            </ul>
            {(canEdit || canReview) && live && <div className="px-5 pb-5"><SourceForm claimId={id} /></div>}
          </Card>
          <Card>
            <CardHeader title="Wording history" />
            <ol className="divide-y divide-line">
              {claim.wordings.map((w) => (
                <li key={w.id} className="px-5 py-3 text-sm">
                  <div className="text-xs text-muted">v{w.version} by {w.created_by_name}, {formatDateTime(w.created_at)}</div>
                  <p className="mt-1 whitespace-pre-wrap">{w.wording}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <div className="space-y-6">
          {(canEdit || canReview) && live && <Card><CardHeader title="Assign a review" /><div className="px-5 pb-5"><AssignReviewForm claimId={id} reviewers={data.reviewers} /></div></Card>}
          {canEdit && live && <Card><CardHeader title="Change the wording" /><div className="px-5 pb-5"><WordingForm claimId={id} /></div></Card>}
        </div>
      </div>
    </>
  );
}
