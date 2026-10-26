import { label } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { Table, Td, Th } from "@/components/ui/Table";
import { channelsFor, dimensionRows, formatCount, formatMove, formatPercentPoint, pairMetric } from "@/lib/site-metrics";
import type { SiteView } from "@/lib/site-view";

function Row({ name, value }: { name: string; value: string }) {
  return <li className="flex items-start justify-between gap-4 px-5 py-3 text-sm"><span>{name}</span><span className="num text-right font-medium">{value}</span></li>;
}

export function AnalyticsDetail({ view }: { view: SiteView }) {
  const periods = { current: view.current, previous: view.previous };
  const sessions = pairMetric(view.snapshots, periods, "sessions", "ga4_export");
  const impressions = pairMetric(view.snapshots, periods, "impressions", "search_console_export");
  const clicks = pairMetric(view.snapshots, periods, "clicks", "search_console_export");
  const enquiries = pairMetric(view.snapshots, periods, "enquiries", "clinic_records", "all");
  const forms = pairMetric(view.snapshots, periods, "form_submissions", "manual", "all");
  const formStarts = pairMetric(view.snapshots, periods, "form_starts", "manual", "all");
  const formFailures = pairMetric(view.snapshots, periods, "form_failures", "manual", "all");
  const contactClicks = pairMetric(view.snapshots, periods, "contact_clicks", "manual", "all");
  const contactActions = [
    { name: "WhatsApp", pair: pairMetric(view.snapshots, periods, "contact_whatsapp", "manual", "all") },
    { name: "Telephone", pair: pairMetric(view.snapshots, periods, "contact_phone", "manual", "all") },
    { name: "Email", pair: pairMetric(view.snapshots, periods, "contact_email", "manual", "all") },
    { name: "Booking link", pair: pairMetric(view.snapshots, periods, "contact_booking", "manual", "all") },
  ];
  const completion = formStarts.current && forms.current !== null && formStarts.current > 0 ? `${((forms.current / formStarts.current) * 100).toFixed(1)}%` : null;
  const ctr = impressions.current && clicks.current !== null && impressions.current > 0 ? `${((clicks.current / impressions.current) * 100).toFixed(1)}%` : null;
  const position = pairMetric(view.snapshots, periods, "avg_position", "search_console_export", "organic_search");
  const bounce = pairMetric(view.snapshots, periods, "bounce_rate", "ga4_export", "all");
  const sources = channelsFor(view.snapshots, view.current, "sessions", "ga4_export", view.previous);
  const enquirySources = channelsFor(view.snapshots, view.current, "enquiries", "clinic_records", view.previous);
  const devices = [
    { name: "Mobile", pair: pairMetric(view.snapshots, periods, "device_sessions", "manual", "mobile") },
    { name: "Desktop", pair: pairMetric(view.snapshots, periods, "device_sessions", "manual", "desktop") },
    { name: "Tablet", pair: pairMetric(view.snapshots, periods, "device_sessions", "manual", "tablet") },
  ];
  const landingSessions = dimensionRows(view.snapshots, view.current, "landing_sessions", "manual");
  const landingContacts = new Map(dimensionRows(view.snapshots, view.current, "landing_contacts", "manual").map((row) => [row.name, row.current]));
  const contactLine = contactActions.every((item) => item.pair.current === null)
    ? "Contact clicks are not recorded, so they are not shown as a number beside this funnel."
    : `Contact clicks this period: ${formatCount(contactClicks.current)}. ${contactActions.map((item) => `${item.name} ${formatCount(item.pair.current)}`).join(", ")}.`;
  const connections = [
    ["ga4", "Website analytics"],
    ["search_console", "Google Search"],
    ["google_ads", "Paid campaigns"],
  ] as const;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Enquiry funnel" description="Website sessions, then form starts, then successful submissions. Contact clicks sit beside the funnel because a visitor can use WhatsApp without completing a form." />
        <ol className="grid gap-3 px-5 pb-5 md:grid-cols-3">
          <li className="rounded-2xl bg-brand-pale p-4"><p className="text-sm text-ink-soft">Website sessions</p><p className="num mt-1 text-2xl font-semibold">{formatCount(sessions.current)}</p><p className="mt-1 text-xs text-muted">{formatMove(sessions.percent) ?? "No previous period"}</p></li>
          <li className="rounded-2xl bg-surface-muted p-4"><p className="text-sm text-ink-soft">Form starts</p><p className={formStarts.current === null ? "mt-1 text-2xl font-semibold text-ink-soft" : "num mt-1 text-2xl font-semibold"}>{formatCount(formStarts.current)}</p><p className="mt-1 text-xs text-muted">{formatMove(formStarts.percent) ?? "No previous period"}</p></li>
          <li className="rounded-2xl bg-surface-muted p-4"><p className="text-sm text-ink-soft">Successful submissions</p><p className={forms.current === null ? "mt-1 text-2xl font-semibold text-ink-soft" : "num mt-1 text-2xl font-semibold"}>{formatCount(forms.current)}</p><p className="mt-1 text-xs text-muted">{forms.current === null ? `Stored enquiries this period: ${formatCount(enquiries.current)}. That total is not a form-completion count.` : `${formatMove(forms.percent) ?? "No previous period"}. Stored enquiries are a separate count.`}</p></li>
        </ol>
        <p className="px-5 pb-5 text-sm text-muted">{contactLine}</p>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Form performance" description="Form starts, successful submissions, completion rate and submission failures." />
          <ul className="divide-y divide-line">
            <Row name="Form starts" value={formatCount(formStarts.current)} />
            <Row name="Successful submissions" value={formatCount(forms.current)} />
            <Row name="Completion rate" value={completion ?? (formStarts.current === 0 ? "No form starts" : "Not recorded")} />
            <Row name="Submission failures" value={formatCount(formFailures.current)} />
          </ul>
        </Card>
        <Card>
          <CardHeader title="Contact-action breakdown" description="Whether visitors use WhatsApp, telephone, email or a booking link." />
          <ul className="divide-y divide-line">
            {contactActions.map((item) => <Row key={item.name} name={item.name} value={formatCount(item.pair.current)} />)}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Landing-page performance" description="Which first pages attract visitors and encourage contact." />
        {landingSessions.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">Landing pages are not in the recorded export.</p> : (
          <Table caption="Landing pages">
            <thead><tr><Th>Page</Th><Th align="right">Sessions</Th><Th align="right">Contact clicks</Th></tr></thead>
            <tbody>
              {landingSessions.map((page) => (
                <tr key={page.name}><Td>{page.name}</Td><Td align="right">{formatCount(page.current)}</Td><Td align="right">{formatCount(landingContacts.get(page.name) ?? null)}</Td></tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader title="Enquiries by source" description="Which channels generate stored enquiries. This is not an order or purchase report." />
        {enquirySources.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">Stored enquiries are recorded as one clinic total ({formatCount(enquiries.current)} this period), not by traffic source, page or device.</p> : (
          <Table caption="Enquiries by source">
            <thead><tr><Th>Source</Th><Th align="right">Enquiries</Th></tr></thead>
            <tbody>
              {enquirySources.filter((source) => source.current > 0).map((source) => (
                <tr key={source.channel}><Td>{label(source.channel)}</Td><Td align="right">{formatCount(source.current)}</Td></tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader title="Device comparison" description="Whether mobile visitors struggle to contact the clinic." />
        {devices.some((item) => item.pair.current === null) ? <p className="px-5 pb-5 text-sm text-muted">Device splits are not recorded. Engagement rate is not recorded either. Bounce rate is left for a detailed report once engagement is connected.</p> : (
          <ul className="divide-y divide-line">
            {devices.map((item) => <Row key={item.name} name={item.name} value={formatCount(item.pair.current)} />)}
            <Row name="Bounce rate" value={formatPercentPoint(bounce.current)} />
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Google Search performance" description="Clicks, impressions and click-through rate for the recorded period. Queries, average position and landing pages are separate and not included." />
        <Table caption="Google Search totals">
          <thead><tr><Th>Measure</Th><Th align="right">Current</Th><Th align="right">Previous</Th><Th align="right">Change</Th></tr></thead>
          <tbody>
            <tr><Td>Clicks</Td><Td align="right">{formatCount(clicks.current)}</Td><Td align="right">{formatCount(clicks.previous)}</Td><Td align="right">{formatMove(clicks.percent) ?? "—"}</Td></tr>
            <tr><Td>Impressions</Td><Td align="right">{formatCount(impressions.current)}</Td><Td align="right">{formatCount(impressions.previous)}</Td><Td align="right">{formatMove(impressions.percent) ?? "—"}</Td></tr>
            <tr><Td>Click-through rate</Td><Td align="right">{ctr ?? "Not recorded"}</Td><Td align="right">—</Td><Td align="right">—</Td></tr>
            <tr><Td>Average position</Td><Td align="right">{formatCount(position.current)}</Td><Td align="right">{formatCount(position.previous)}</Td><Td align="right">{formatMove(position.percent) ?? "—"}</Td></tr>
          </tbody>
        </Table>
        {sources.length > 0 && <p className="px-5 py-3 text-xs text-muted">Session channels recorded: {sources.map((source) => label(source.channel)).join(", ")}.</p>}
      </Card>

      <Card>
        <CardHeader title="Data connection status" description="A saved reference is not a live integration." />
        <Table caption="Integration status">
          <thead><tr><Th>Integration</Th><Th>Status</Th><Th>Last export</Th></tr></thead>
          <tbody>
            {connections.map(([kind, name]) => {
              const reference = view.references.find((item) => item.kind === kind);
              return (
                <tr key={kind}>
                  <Td>{name}</Td>
                  <Td>{reference ? "Reference saved, not connected" : "Not connected"}</Td>
                  <Td>{view.updatedAt ? "See the period above" : "No export"}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <div className="px-5 pb-5"><Notice tone="neutral">AI referrals, Google AI visibility and an on-site chat are different measurements. None of them is connected, and private AI prompts are never collected.</Notice></div>
      </Card>
    </div>
  );
}
