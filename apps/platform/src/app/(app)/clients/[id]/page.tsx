import Link from "next/link";
import { formatDateTime, getClient, listAccountReferences, listApprovals, listClientContacts, listClientFileLinks, listIssues, listMemberships, listTimeline, listWebsites } from "@clinic-genie/db";
import { requireClientAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { Card, CardHeader, KeyValue, Stat } from "@/components/ui/Card";
import { Badge, label } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

function workspaceLinks(clientId: string, slug: string, websites: Array<{ id: string; environment: string }>) {
  const site = websites.find((item) => item.environment === "production") ?? websites[0];
  const query = site ? `client=${clientId}&website=${site.id}` : `client=${clientId}`;
  return [
    { href: `/analytics?${query}`, label: "Website analytics" },
    { href: `/seo?${query}`, label: "SEO performance" },
    { href: `/blog?${query}`, label: "Blog" },
    { href: `/enquiries?clinic=${encodeURIComponent(slug)}`, label: "Leads and forms" },
    { href: `/reports?client=${clientId}`, label: "Reports" },
  ];
}

export default async function ClientOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireClientAccess(id);
  const data = await staffTx(access, async (db) => ({
    client: (await getClient(db, id))!,
    websites: await listWebsites(db, id),
    refs: await listAccountReferences(db, id),
    members: await listMemberships(db, id),
    contacts: await listClientContacts(db, id),
    files: await listClientFileLinks(db, id),
    approvals: await listApprovals(db, { clientId: id, statuses: ["submitted"] }),
    issues: await listIssues(db, { clientId: id, statuses: ["open", "investigating", "resolved_pending_verification", "reopened"] }),
    timeline: (await listTimeline(db, { clientId: id, limit: 20 })).filter((event) => !event.event_type.startsWith("task_")).slice(0, 10),
  }));
  return (
    <>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Stat label="Approvals submitted" value={data.approvals.length} tone={data.approvals.length ? "warn" : undefined} />
        <Stat label="Open issues" value={data.issues.length} tone={data.issues.some((i) => i.severity === "critical") ? "bad" : undefined} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Recent activity" action={<Link href={`/clients/${id}/timeline`} className="text-sm text-action hover:underline">Timeline</Link>} />
            <ol className="divide-y divide-line">
              {data.timeline.length === 0 && <li className="px-5 py-3 text-sm text-muted">No activity recorded yet.</li>}
              {data.timeline.map((e) => (
                <li key={e.id} className="px-5 py-2.5 text-sm flex flex-col sm:flex-row sm:gap-4">
                  <span className="text-xs text-muted whitespace-nowrap sm:w-36">{formatDateTime(e.occurred_at)}</span>
                  <span>{e.title}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-base font-semibold mb-3">Profile</h2>
            <KeyValue items={[
              { label: "Client ID", value: data.client.reference_number },
              { label: "Short code", value: data.client.short_code },
              { label: "Specialty", value: data.client.specialty },
              { label: "Public name", value: data.client.public_name },
              { label: "Registered name", value: data.client.legal_name },
              { label: "Address", value: data.client.address },
              { label: "General contact", value: [data.client.contact_email, data.client.contact_phone].filter(Boolean).join(" · ") || null },
              { label: "Primary contact", value: data.contacts.find((contact) => contact.is_primary)?.name ?? null },
              { label: "Status", value: data.client.status === "active" ? "Active" : "Inactive" },
              { label: "Enquiries", value: data.client.enquiry_owner_name },
              { label: "Notifications", value: data.client.notification_owner_name },
              { label: "Account administration", value: data.client.administration_owner_name },
              { label: "Services", value: data.client.services },
              { label: "Channels", value: data.client.channels.length ? <span className="flex flex-wrap gap-1">{data.client.channels.map((c) => <Badge key={c}>{label(c)}</Badge>)}</span> : null },
              { label: "Assigned team", value: data.members.map((m) => `${m.user_name} (${label(m.user_role)})`).join(", ") || null },
            ]} />
            {data.client.notes && <p className="text-sm text-muted mt-3 whitespace-pre-wrap">{data.client.notes}</p>}
            <Link href={`/clients/${id}/profile`} className="text-sm text-action hover:underline mt-3 inline-block">Edit profile, websites and references</Link>
          </Card>
          <Card className="p-5">
            <h2 className="text-base font-semibold mb-3">Workspace</h2>
            <ul className="space-y-2 text-sm">
              {workspaceLinks(id, data.client.slug, data.websites).map((item) => (
                <li key={item.href}><Link href={item.href} className="text-action hover:underline">{item.label}</Link></li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h2 className="text-base font-semibold mb-3">Files</h2>
            <p className="mb-2 text-xs text-muted">Titled links. The hosting site controls who can open the file.</p>
            <ul className="space-y-2 text-sm">
              {data.files.length === 0 && <li className="text-muted">None recorded.</li>}
              {data.files.map((file) => (
                <li key={file.id}><a href={file.url} className="text-action hover:underline break-all" rel="noreferrer" target="_blank">{file.title}</a></li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h2 className="text-base font-semibold mb-3">Websites</h2>
            <ul className="space-y-2 text-sm">
              {data.websites.length === 0 && <li className="text-muted">None recorded.</li>}
              {data.websites.map((w) => (
                <li key={w.id}>
                  <span className="font-medium">{w.name}</span> <Badge tone={w.status === "active" ? "good" : "neutral"}>{label(w.environment)}</Badge>
                  {w.url && <div><a href={w.url} className="text-action hover:underline break-all" rel="noreferrer" target="_blank">{w.url}</a></div>}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h2 className="text-base font-semibold mb-3">Account references</h2>
            <p className="text-xs text-muted mb-2">Saved links and identifiers only. Not connected integrations. Credentials live in the vault.</p>
            <ul className="space-y-2 text-sm">
              {data.refs.length === 0 && <li className="text-muted">None recorded.</li>}
              {data.refs.map((r) => (
                <li key={r.id}>
                  <Badge>{label(r.kind)}</Badge> <span className="font-medium">{r.label}</span>{r.owner_name && <span className="text-muted"> · {r.owner_name}</span>}
                  {r.external_identifier && <span className="text-muted"> · {r.external_identifier}</span>}
                  {r.url && <div><a href={r.url} className="text-action hover:underline break-all" rel="noreferrer" target="_blank">{r.url}</a></div>}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
