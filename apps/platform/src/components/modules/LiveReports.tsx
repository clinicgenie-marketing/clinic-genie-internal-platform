import Link from "next/link";
import { canExport } from "@clinic-genie/db";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { analyticsSearch } from "@/lib/period-options";
import { dimensionRows, formatCount } from "@/lib/site-metrics";
import type { SiteView } from "@/lib/site-view";
import { formRatio, loadLiveBundle, reportRows, type LiveBundle, type LiveValue } from "@/lib/live-analytics";
import { Card, CardHeader, Stat } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { NavigationFlows } from "@/components/modules/NavigationFlows";

function figure(metric: LiveValue) {
  if (metric.state === "not_connected") return "Not connected";
  if (metric.value === null) return "Unavailable";
  return formatCount(metric.value);
}

function Metric({ label, metric }: { label: string; metric: LiveValue }) {
  return <Stat label={label} value={figure(metric)} hint={metric.note} />;
}

function Rows({ title, rows, empty }: { title: string; rows: Array<{ label: string; value: number | null; state: string }>; empty: string }) {
  return (
    <Card>
      <CardHeader title={title} />
      {rows.length === 0 && <p className="px-5 pb-5 text-sm text-ink-soft">{empty}</p>}
      {rows.length > 0 && (
        <ul className="px-5 pb-5">
          {rows.slice(0, 8).map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-3 border-t border-line py-2 text-sm">
              <span className="truncate text-ink">{row.label}</span>
              <span className="num text-ink">{row.state === "available" && row.value !== null ? formatCount(row.value) : "Unavailable"}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Tabs({ base, current, tabs, query }: { base: string; current: string; tabs: Array<{ id: string; label: string }>; query: string }) {
  return (
    <nav aria-label="Report sections" className="mb-4 overflow-x-auto">
      <ul className="flex min-w-max gap-1">
        {tabs.map((tab) => (
          <li key={tab.id}>
            <Link href={`${base}?${query}&tab=${tab.id}`} aria-current={current === tab.id ? "page" : undefined} className={`inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-medium ${current === tab.id ? "bg-brand-pale text-ink" : "text-ink-soft hover:bg-brand-pale/70"}`}>
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Health({ bundle }: { bundle: LiveBundle }) {
  const traffic = bundle.conflict ? "Two traffic sources" : bundle.provider ? bundle.provider.toUpperCase() : "Not connected";
  const tone = bundle.conflict || bundle.providerStatus === "reconnect_required" ? "warn" : bundle.providerStatus === "connected" ? "good" : "neutral";
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <Badge tone={tone}>{bundle.conflict ? "Choose one traffic source" : traffic}</Badge>
      <Badge tone={bundle.searchStatus === "connected" ? "good" : "neutral"}>{bundle.searchStatus === "connected" ? "Search Console connected" : "Search Console not connected"}</Badge>
      {bundle.providerStatus === "reconnect_required" && <Badge tone="warn">Reconnect required</Badge>}
    </div>
  );
}

export async function LiveOverview({ view }: { view: SiteView }) {
  const access = await requireAccess();
  const bundle = await staffTx(access, (db) => loadLiveBundle(db, view));
  const download = canExport(access) && view.websiteId && view.current && bundle.provider
    ? `/api/analytics/export?client=${view.clientId}&website=${view.websiteId}&template=${bundle.provider === "ga4" ? "ga4.traffic_daily" : "wix.data_daily"}&start=${view.current.start}&end=${view.current.end}`
    : null;
  return (
    <div>
      <Health bundle={bundle} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric label="Sessions" metric={bundle.sessions} />
        <Metric label={bundle.provider === "ga4" ? "Users" : "Visitors"} metric={bundle.users} />
        <Metric label="Contact clicks" metric={bundle.contacts} />
        <Metric label="Tracked form events" metric={bundle.forms} />
      </div>
      {bundle.comparison && <p className="mt-3 text-sm text-ink-soft">{bundle.comparison}</p>}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Rows title="Sources" rows={reportRows(bundle.sources, "sessions")} empty={bundle.provider === "wix" ? "Source detail is not in the Wix daily measures." : "Unavailable for this period."} />
        <Card>
          <CardHeader title="Contacts and stored enquiries" description="Contact clicks are events. Stored enquiries are clinic records." />
          <div className="grid grid-cols-2 gap-4 px-5 pb-5">
            <Stat label="Contact clicks" value={figure(bundle.contacts)} hint={bundle.contacts.note} />
            <Stat label="Stored enquiries" value={bundle.enquiries.current === null ? "Not recorded" : formatCount(bundle.enquiries.current)} hint="Clinic records, not a traffic provider." />
          </div>
        </Card>
        <Rows title="Top pages" rows={reportRows(bundle.landing, ["sessions", "screenPageViews"])} empty="Unavailable for this period." />
        <Rows title="Organic search" rows={reportRows(bundle.search, "clicks")} empty={bundle.searchStatus === "connected" ? "Unavailable for this period. Search Console dates stay in Pacific time." : "Not connected."} />
      </div>
      {download && <a className="mt-4 inline-flex text-sm font-semibold text-action hover:underline" href={download}>Download this period</a>}
    </div>
  );
}

const TRAFFIC_TABS = [
  { id: "acquisition", label: "Acquisition" },
  { id: "campaigns", label: "Campaigns" },
  { id: "landing", label: "Landing pages" },
  { id: "audience", label: "Audience" },
  { id: "organic", label: "Organic search" },
];

export async function LiveTraffic({ view, tab, range, from, to }: { view: SiteView; tab?: string; range: string; from?: string; to?: string }) {
  const access = await requireAccess();
  const bundle = await staffTx(access, (db) => loadLiveBundle(db, view));
  const current = TRAFFIC_TABS.some((item) => item.id === tab) ? tab! : "acquisition";
  const query = analyticsSearch(view.clientId, range, from, to, view.websiteId ?? undefined);
  return (
    <div>
      <Health bundle={bundle} />
      <Tabs base="/analytics/traffic" current={current} tabs={TRAFFIC_TABS} query={query} />
      {current === "acquisition" && <Rows title="Acquisition" rows={reportRows(bundle.sources, "sessions")} empty="Unavailable. A GA4 user split is not shown as a complete donut." />}
      {current === "campaigns" && <p className="text-sm text-ink-soft">Campaign detail is unavailable until a provider report names campaigns. Filters from GA4 are not applied to Search Console.</p>}
      {current === "landing" && <Rows title="Landing pages" rows={reportRows(bundle.landing, ["sessions", "screenPageViews"])} empty="Unavailable for this period." />}
      {current === "audience" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Rows title="Device" rows={reportRows(bundle.devices, "sessions")} empty="Unavailable for this period." />
          <Rows title="Country" rows={reportRows(bundle.countries, "sessions")} empty="Unavailable for this period." />
          <Card className="lg:col-span-2">
            <CardHeader title="Weekday average" description="Complete recorded days only. A missing day is left out." />
            <ul className="grid grid-cols-2 gap-2 px-5 pb-5 sm:grid-cols-4 lg:grid-cols-7">
              {bundle.weekdays.map((day) => (
                <li key={day.weekday} className="rounded-xl bg-brand-pale px-3 py-2">
                  <div className="text-xs text-muted">{day.weekday}</div>
                  <div className="num text-sm font-semibold text-ink">{day.average === null ? "Unavailable" : formatCount(day.average)}</div>
                </li>
              ))}
            </ul>
            {bundle.weekdays.length === 0 && <p className="px-5 pb-5 text-sm text-ink-soft">Unavailable.</p>}
          </Card>
        </div>
      )}
      {current === "organic" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Rows title="Property total" rows={reportRows(bundle.search, "clicks")} empty="Unavailable. This total is separate from the top rows." />
          <Rows title="Pages" rows={reportRows(bundle.searchPages, "clicks")} empty="Unavailable." />
          <Rows title="Queries" rows={reportRows(bundle.searchQueries, "clicks")} empty="Unavailable." />
        </div>
      )}
    </div>
  );
}

const BEHAVIOUR_TABS = [
  { id: "pages", label: "Pages" },
  { id: "interactions", label: "Interactions" },
  { id: "forms", label: "Forms and enquiries" },
  { id: "content", label: "Content" },
  { id: "journeys", label: "Journeys" },
];

export async function LiveBehaviour({ view, tab, range, from, to }: { view: SiteView; tab?: string; range: string; from?: string; to?: string }) {
  const access = await requireAccess();
  const bundle = await staffTx(access, (db) => loadLiveBundle(db, view));
  const current = BEHAVIOUR_TABS.some((item) => item.id === tab) ? tab! : "pages";
  const query = analyticsSearch(view.clientId, range, from, to, view.websiteId ?? undefined);
  const flows = dimensionRows(view.snapshots, view.current, "nav_flow", "manual");
  const ratio = formRatio(bundle.forms);
  return (
    <div>
      <Health bundle={bundle} />
      <Tabs base="/analytics/behavior" current={current} tabs={BEHAVIOUR_TABS} query={query} />
      {current === "pages" && <Rows title="Pages" rows={reportRows(bundle.landing, ["sessions", "screenPageViews"])} empty="Page views for this period are unavailable." />}
      {current === "interactions" && <Metric label="Contact clicks" metric={bundle.contacts} />}
      {current === "forms" && (
        <Card>
          <CardHeader title="Forms and enquiries" description={ratio.label} />
          <div className="grid grid-cols-2 gap-4 px-5 pb-5">
            <Stat label="Tracked form events" value={figure(bundle.forms)} hint={ratio.text} />
            <Stat label="Stored enquiries" value={bundle.enquiries.current === null ? "Not recorded" : formatCount(bundle.enquiries.current)} hint="Clinic records." />
          </div>
        </Card>
      )}
      {current === "content" && <p className="text-sm text-ink-soft">Content engagement is unavailable until the site semantic model names those fields. No field names are assumed.</p>}
      {current === "journeys" && (
        <Card>
          <CardHeader title="Journeys" description="Stored navigation flows. This is not an event sequence." />
          <div className="px-5 pb-5">
            {flows.length > 0 ? <NavigationFlows flows={flows} /> : <p className="text-sm text-ink-soft">No stored journey is recorded for this period.</p>}
            <p className="mt-3 text-sm text-ink-soft">An ordered funnel is unavailable. Unrelated totals are not drawn as steps.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
