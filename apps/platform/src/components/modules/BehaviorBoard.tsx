import Link from "next/link";
import { ChevronDown, ChevronUp, MousePointerClick, Route } from "lucide-react";
import { label } from "@/components/ui/Badge";
import { channelsFor, dimensionRows, formatCount, formatDuration, formatPercentPoint, pairMetric } from "@/lib/site-metrics";
import type { SiteView } from "@/lib/site-view";
import { FormSplit, TopPages } from "./BehaviorPanels";
import { NavigationFlows } from "./NavigationFlows";
import type { BreakdownLinks } from "@/lib/report-link";

function Move({ percent }: { percent: number | null }) {
  if (percent === null) return null;
  const down = percent < 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-sm font-semibold ${down ? "text-bad" : "text-good"}`}>
      {down ? <ChevronDown className="size-3.5" aria-hidden="true" /> : <ChevronUp className="size-3.5" aria-hidden="true" />}
      <span className="sr-only">{down ? "Down" : "Up"} </span>
      {Math.abs(percent)}%
    </span>
  );
}

function ReportLink({ href }: { href: string }) {
  return <Link href={href} className="inline-flex px-5 pb-5 text-sm font-semibold text-action hover:underline">View Report</Link>;
}

function Figure({ value }: { value: number | null }) {
  return <span className={value === null ? "text-2xl font-semibold text-ink-soft" : "num text-3xl font-semibold tracking-tight"}>{formatCount(value)}</span>;
}

export function BehaviorBoard({ view, reportLinks }: { view: SiteView; reportLinks: BreakdownLinks }) {
  const periods = { current: view.current, previous: view.previous };
  const submissions = pairMetric(view.snapshots, periods, "form_submissions", "manual", "all");
  const formViews = pairMetric(view.snapshots, periods, "form_views", "manual", "all");
  const formStarts = pairMetric(view.snapshots, periods, "form_starts", "manual", "all");
  const enquiries = pairMetric(view.snapshots, periods, "enquiries", "clinic_records", "all");
  const duration = pairMetric(view.snapshots, periods, "avg_session_duration", "ga4_export", "all");
  const pagesPerSession = pairMetric(view.snapshots, periods, "pages_per_session", "ga4_export", "all");
  const bounce = pairMetric(view.snapshots, periods, "bounce_rate", "ga4_export", "all");
  const headlines = [
    { name: "Avg. session duration", value: duration.current, text: formatDuration(duration.current) },
    { name: "Avg. pages per session", value: pagesPerSession.current, text: formatCount(pagesPerSession.current) },
    { name: "Bounce rate", value: bounce.current, text: formatPercentPoint(bounce.current) },
  ];
  const pages = {
    visits: dimensionRows(view.snapshots, view.current, "page_visits", "manual"),
    clicks: dimensionRows(view.snapshots, view.current, "page_clicks", "manual"),
    time: dimensionRows(view.snapshots, view.current, "page_time", "manual"),
    exit: dimensionRows(view.snapshots, view.current, "page_exit_rate", "manual"),
  };
  const clicks = dimensionRows(view.snapshots, view.current, "click_target", "manual");
  const flows = dimensionRows(view.snapshots, view.current, "nav_flow", "manual");
  const formSources = channelsFor(view.snapshots, view.current, "form_submissions", "manual", view.previous).flatMap((row) => (row.current > 0 ? [{ name: label(row.channel), current: row.current }] : []));
  const formLocations = dimensionRows(view.snapshots, view.current, "form_location", "manual");

  return (
    <div className="space-y-4">
      <section className="card grid sm:grid-cols-3" aria-label="Session quality">
        {headlines.map((item, index) => (
          <div key={item.name} className={`px-5 py-4 ${index > 0 ? "border-t border-line sm:border-t-0 sm:border-l" : ""}`}>
            <p className="text-sm text-ink-soft">{item.name}</p>
            <p className={item.value === null ? "mt-1 text-2xl font-semibold text-ink-soft" : "num mt-1 text-3xl font-semibold tracking-tight"}>{item.text}</p>
          </div>
        ))}
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(16rem,0.9fr)]">
        <section className="card" aria-labelledby="top-pages">
          <h2 id="top-pages" className="px-5 pt-5 pb-3 text-base font-semibold">Top pages by</h2>
          <TopPages pages={pages} />
          <ReportLink href={reportLinks.pages} />
        </section>

        <section className="card" aria-labelledby="top-clicks">
          <h2 id="top-clicks" className="flex items-center gap-2 px-5 pt-5 pb-2 text-base font-semibold">
            <MousePointerClick className="size-4 text-ink-soft" aria-hidden="true" />
            Top clicks
          </h2>
          {clicks.length === 0 ? (
            <p className="px-5 pt-3 pb-4 text-sm text-muted">Not recorded. Clicks are not split by button or link.</p>
          ) : (
            <ul className="space-y-3 px-5 pt-3 pb-4">
              {clicks.map((click) => (
                <li key={click.name} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{click.name}</span>
                  <span className="num font-semibold">{formatCount(click.current)}</span>
                </li>
              ))}
            </ul>
          )}
          <ReportLink href={reportLinks.clicks} />
        </section>
      </div>

      <section className="card" aria-labelledby="navigation-flows">
        <div className="px-5 pt-5 pb-2">
          <h2 id="navigation-flows" className="flex items-center gap-2 text-base font-semibold">
            <Route className="size-4 text-ink-soft" aria-hidden="true" />
            Top navigation flows
          </h2>
          <p className="pt-1 text-sm text-ink-soft">The first pages visitors open, in order.</p>
        </div>
        {flows.length === 0 ? (
          <p className="px-5 pt-3 pb-4 text-sm text-muted">Not recorded. The export does not include the path from one page to the next.</p>
        ) : (
          <NavigationFlows flows={flows} />
        )}
        <ReportLink href={reportLinks.paths} />
      </section>

      <section className="card" aria-labelledby="form-submissions">
        <h2 id="form-submissions" className="px-5 pt-5 pb-4 text-base font-semibold">Form submissions</h2>
        <div className="grid gap-6 px-5 pb-5 lg:grid-cols-3">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-ink-soft">Form views</p>
              <p className="mt-1 flex flex-wrap items-baseline gap-2">
                <Figure value={formViews.current} />
                <Move percent={formViews.percent} />
              </p>
            </div>
            <div>
              <p className="text-sm text-ink-soft">Submissions started</p>
              <p className="mt-1 flex flex-wrap items-baseline gap-2">
                <Figure value={formStarts.current} />
                <Move percent={formStarts.percent} />
              </p>
            </div>
            <div>
              <p className="text-sm text-ink-soft">Total submissions</p>
              <p className="mt-1 flex flex-wrap items-baseline gap-2">
                <Figure value={submissions.current} />
                <Move percent={submissions.percent} />
              </p>
            </div>
          </div>
          <div className="border-t border-line pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
            <p className="text-sm text-ink-soft">Enquiries</p>
            {enquiries.current === null ? (
              <p className="mt-2 text-sm text-muted">Not recorded.</p>
            ) : (
              <p className="mt-1 flex flex-wrap items-baseline gap-2">
                <Figure value={enquiries.current} />
                <Move percent={enquiries.percent} />
              </p>
            )}
          </div>
          <div className="border-t border-line pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
            <FormSplit sources={formSources} locations={formLocations} />
          </div>
        </div>
        <ReportLink href={reportLinks.forms} />
      </section>
    </div>
  );
}
