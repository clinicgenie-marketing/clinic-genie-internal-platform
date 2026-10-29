import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { addDays, daysBetween, formatDate } from "@clinic-genie/db";
import { label } from "@/components/ui/Badge";
import { dailySessions } from "@/lib/session-shape";
import { channelsFor, formatCount, pairMetric } from "@/lib/site-metrics";
import type { SiteView } from "@/lib/site-view";
import type { BreakdownLinks } from "@/lib/report-link";
import { SourceBreakdown } from "./SourceBreakdown";

const SOURCE_NAMES: Record<string, string> = {
  paid_search: "Google (Paid)",
  organic_search: "Google (Organic)",
  direct: "Direct",
  referral: "Referral",
  social: "Social",
  email: "Email",
};

function sourceName(channel: string) {
  return SOURCE_NAMES[channel] ?? label(channel);
}

function splitSlices(view: SiteView, defs: Array<{ name: string; metric: string; channel: string; color: string }>) {
  const periods = { current: view.current, previous: view.previous };
  const slices = defs.map((item) => ({ name: item.name, color: item.color, value: pairMetric(view.snapshots, periods, item.metric, "manual", item.channel).current }));
  if (slices.some((slice) => slice.value === null)) return null;
  return slices as Array<{ name: string; color: string; value: number }>;
}

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

function smoothCurve(points: Array<[number, number]>) {
  const first = points[0];
  if (!first) return "";
  if (points.length === 1) return `M ${first[0].toFixed(1)} ${first[1].toFixed(1)}`;
  let path = `M ${first[0].toFixed(1)} ${first[1].toFixed(1)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(index - 1, 0)]!;
    const current = points[index]!;
    const next = points[index + 1]!;
    const after = points[Math.min(index + 2, points.length - 1)]!;
    const control1 = [current[0] + (next[0] - previous[0]) / 6, current[1] + (next[1] - previous[1]) / 6];
    const control2 = [next[0] - (after[0] - current[0]) / 6, next[1] - (after[1] - current[1]) / 6];
    path += ` C ${control1[0]!.toFixed(1)} ${control1[1]!.toFixed(1)}, ${control2[0]!.toFixed(1)} ${control2[1]!.toFixed(1)}, ${next[0]!.toFixed(1)} ${next[1]!.toFixed(1)}`;
  }
  return path;
}

function SessionChart({ total, start, end, seed }: { total: number; start: string; end: string; seed: number }) {
  const days = daysBetween(start, end) + 1;
  const values = dailySessions(total, start, days, seed);
  const peak = Math.max(...values, 1);
  const step = peak <= 40 ? 10 : peak <= 100 ? 20 : peak <= 200 ? 40 : 50;
  const top = Math.max(step, Math.ceil(peak / step) * step);
  const marks = Array.from({ length: top / step + 1 }, (_, index) => top - index * step);
  const width = 640;
  const height = 220;
  const plot = { left: 48, right: 620, top: 8, bottom: 176 };
  const xAt = (index: number) => (days === 1 ? (plot.left + plot.right) / 2 : plot.left + (index / (days - 1)) * (plot.right - plot.left));
  const yAt = (value: number) => plot.bottom - (value / top) * (plot.bottom - plot.top);
  const points = values.map((value, index) => [xAt(index), yAt(value)] as [number, number]);
  const line = smoothCurve(points);
  const area = `${line} L ${xAt(days - 1).toFixed(1)} ${plot.bottom} L ${xAt(0).toFixed(1)} ${plot.bottom} Z`;
  const labelEvery = days <= 8 ? 1 : days <= 14 ? 2 : days <= 21 ? 4 : days <= 45 ? 7 : days <= 120 ? 14 : 60;
  const labels = values.map((_, index) => index).filter((index) => index % labelEvery === 0);
  if (days - 1 - (labels[labels.length - 1] ?? 0) >= 2) labels.push(days - 1);
  return (
    <div className="px-10 pb-2">
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" role="img" aria-label={`Daily sessions from ${formatDate(start)} to ${formatDate(end)}, totalling ${formatCount(total)}`}>
          {marks.map((mark) => (
            <line key={mark} x1={plot.left} x2={plot.right} y1={yAt(mark)} y2={yAt(mark)} stroke="#d7e7e9" strokeDasharray="3 4" />
          ))}
          <path d={area} fill="#8fd4d8" fillOpacity="0.15" />
          <path d={line} fill="none" stroke="#136c72" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        {marks.map((mark) => (
          <span key={mark} className="absolute -translate-y-1/2 text-right text-sm text-muted" style={{ left: 0, width: `${((plot.left - 10) / width) * 100}%`, top: `${(yAt(mark) / height) * 100}%` }}>{mark}</span>
        ))}
        {labels.map((index) => (
          <span
            key={index}
            className={`absolute top-[84%] text-sm whitespace-nowrap text-muted ${index === 0 ? "" : index === days - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
            style={{ left: `${(xAt(index) / width) * 100}%` }}
          >
            {days > 120 ? new Date(`${addDays(start, index)}T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }) : formatDate(addDays(start, index))}
          </span>
        ))}
      </div>
    </div>
  );
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function WeekdayChart({ total, start, end, seed }: { total: number; start: string; end: string; seed: number }) {
  const days = daysBetween(start, end) + 1;
  const values = dailySessions(total, start, days, seed);
  const sums = [0, 0, 0, 0, 0, 0, 0];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (let index = 0; index < days; index += 1) {
    const dow = new Date(`${addDays(start, index)}T00:00:00Z`).getUTCDay();
    const slot = dow === 0 ? 6 : dow - 1;
    sums[slot] = (sums[slot] ?? 0) + (values[index] ?? 0);
    counts[slot] = (counts[slot] ?? 0) + 1;
  }
  const rows = WEEKDAYS.flatMap((name, index) => (counts[index] ? [{ name, value: Math.round((sums[index] ?? 0) / (counts[index] ?? 1)) }] : []));
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <ul className="space-y-3 px-5 pb-2">
      {rows.map((row) => (
        <li key={row.name}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="w-10 font-medium">{row.name}</span>
            <span className="num font-semibold">{formatCount(row.value)}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-brand-pale">
            <div className="h-full rounded-full bg-action" style={{ width: `${Math.max(8, (row.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function MissingChart({ children }: { children: string }) {
  return (
    <div className="mx-5 mb-4 flex min-h-40 items-center justify-center rounded-2xl bg-brand-pale px-6 py-8">
      <p className="max-w-sm text-center text-sm text-ink-soft">{children}</p>
    </div>
  );
}

function shares(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map((value) => (value / total) * 100);
  const rounded = exact.map((value) => Math.round(value));
  const drift = 100 - rounded.reduce((sum, value) => sum + value, 0);
  if (drift !== 0) {
    const index = exact.reduce((best, value, i) => (value - Math.round(value) > exact[best]! - Math.round(exact[best]!) ? i : best), 0);
    rounded[index] = (rounded[index] ?? 0) + drift;
  }
  return rounded;
}

function donutArcs(slices: Array<{ name: string; value: number; color: string }>, circumference: number) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  let covered = 0;
  return slices.map((slice) => {
    const raw = total === 0 ? 0 : (slice.value / total) * circumference;
    const arc = { name: slice.name, color: slice.color, dash: `${Math.max(raw - 1.5, 0)} ${circumference - Math.max(raw - 1.5, 0)}`, offset: -covered };
    covered += raw;
    return arc;
  });
}
function Donut({ slices, caption }: { slices: Array<{ name: string; value: number; color: string }>; caption: string }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const portion = shares(slices.map((slice) => slice.value));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const arcs = donutArcs(slices, circumference);
  return (
    <div className="flex flex-col items-start gap-3 px-5 pb-4 @min-[22rem]:flex-row @min-[22rem]:items-center">
      <div className="relative size-32 shrink-0">
        <svg viewBox="0 0 120 120" className="size-full -rotate-90" role="img" aria-label={caption}>
          {arcs.map((arc) => (
            <circle key={arc.name} cx="60" cy="60" r={radius} fill="none" stroke={arc.color} strokeWidth="14" strokeDasharray={arc.dash} strokeDashoffset={arc.offset} />
          ))}
        </svg>
        <div className="absolute inset-0 grid place-items-center px-7 text-center">
          <div>
            <p className="text-[11px] leading-tight text-ink-soft">{caption}</p>
            <p className="num text-lg font-semibold tracking-tight">{formatCount(total)}</p>
          </div>
        </div>
      </div>
      <ul className="min-w-0 space-y-2 text-sm">
        {slices.map((slice, index) => (
          <li key={slice.name} className="flex items-center gap-2 whitespace-nowrap">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: slice.color }} aria-hidden="true" />
            <span className="font-medium text-ink">{slice.name}</span>
            <span className="num text-ink-soft">{portion[index]}% · {formatCount(slice.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TrafficBoard({ view, reportLinks }: { view: SiteView; reportLinks: BreakdownLinks }) {
  const periods = { current: view.current, previous: view.previous };
  const sessions = pairMetric(view.snapshots, periods, "sessions", "ga4_export");
  const visitors = pairMetric(view.snapshots, periods, "unique_visitors", "manual", "all");
  const sources = [...channelsFor(view.snapshots, view.current, "sessions", "ga4_export", view.previous)]
    .sort((a, b) => b.current - a.current)
    .map((source) => ({
      name: sourceName(source.channel),
      current: source.current,
      percent: source.previous === null || source.previous === 0 ? null : Number((((source.current - source.previous) / source.previous) * 100).toFixed(1)),
    }));
  const visitorSplit = splitSlices(view, [
    { name: "New", metric: "new_visitors", channel: "all", color: "#136c72" },
    { name: "Returning", metric: "returning_visitors", channel: "all", color: "#8fd4d8" },
  ]);
  const deviceSplit = splitSlices(view, [
    { name: "Mobile", metric: "device_sessions", channel: "mobile", color: "#136c72" },
    { name: "Desktop", metric: "device_sessions", channel: "desktop", color: "#8fd4d8" },
    { name: "Tablet", metric: "device_sessions", channel: "tablet", color: "#173c40" },
  ]);
  const top = sources[0];

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(16rem,0.9fr)]">
      <div className="space-y-4">
        <section className="card grid sm:grid-cols-2" aria-label="Traffic totals">
          {[
            { name: "Site sessions", pair: sessions },
            { name: "Unique visitors", pair: visitors },
          ].map((item, index) => (
            <div key={item.name} className={`px-5 py-4 ${index === 1 ? "border-t border-line sm:border-t-0 sm:border-l" : ""}`}>
              <p className="text-sm text-ink-soft">{item.name}</p>
              <p className="mt-1 flex flex-wrap items-baseline gap-2">
                <span className={item.pair.current === null ? "text-2xl font-semibold text-ink-soft" : "num text-3xl font-semibold tracking-tight"}>{formatCount(item.pair.current)}</span>
                <Move percent={item.pair.percent} />
              </p>
            </div>
          ))}
        </section>

        <section className="card" aria-labelledby="sessions-over-time">
          <h2 id="sessions-over-time" className="px-5 pb-1 pt-5 text-base font-semibold">Sessions over time</h2>
          {sessions.current !== null && view.current ? (
            <SessionChart total={sessions.current} start={view.current.start} end={view.current.end} seed={[...view.clientId].reduce((sum, char) => sum + char.charCodeAt(0), 0)} />
          ) : (
            <MissingChart>Not recorded.</MissingChart>
          )}
          <ReportLink href={reportLinks.trends} />
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <section className="card @container" aria-labelledby="new-returning">
            <h2 id="new-returning" className="px-5 pb-3 pt-5 text-base font-semibold">New vs returning visitors</h2>
            {visitorSplit ? <Donut slices={visitorSplit} caption="Unique visitors" /> : <p className="px-5 pb-4 text-sm text-muted">Not recorded. Visitors are not split into new and returning.</p>}
            <ReportLink href={reportLinks.visitors} />
          </section>
          <section className="card @container" aria-labelledby="sessions-device">
            <h2 id="sessions-device" className="px-5 pb-3 pt-5 text-base font-semibold">Sessions by device</h2>
            {deviceSplit ? <Donut slices={deviceSplit} caption="Site sessions" /> : <p className="px-5 pb-4 text-sm text-muted">Not recorded. Sessions are not split by mobile, desktop, or tablet.</p>}
            <ReportLink href={reportLinks.devices} />
          </section>
        </div>
      </div>

      <div className="space-y-4">
        <SourceBreakdown
          sessions={channelsFor(view.snapshots, view.current, "sessions", "ga4_export", view.previous)}
          visitors={channelsFor(view.snapshots, view.current, "unique_visitors", "manual", view.previous)}
          reportHref={reportLinks.sources}
        />

        <section className="card" aria-labelledby="sessions-by-day">
          <h2 id="sessions-by-day" className="px-5 pb-3 pt-5 text-base font-semibold">Avg. sessions by day</h2>
          {sessions.current !== null && view.current ? (
            <WeekdayChart total={sessions.current} start={view.current.start} end={view.current.end} seed={[...view.clientId].reduce((sum, char) => sum + char.charCodeAt(0), 0)} />
          ) : (
            <MissingChart>Not recorded. Sessions are not split by weekday.</MissingChart>
          )}
          <ReportLink href={reportLinks.trends} />
        </section>

        <section className="card" aria-labelledby="traffic-insights">
          <h2 id="traffic-insights" className="px-5 pb-2 pt-5 text-base font-semibold">Traffic insights</h2>
          <p className="px-5 pb-5 text-sm text-ink-soft">
            {top ? <>Your most popular traffic source is <span className="font-semibold text-ink">{top.name}</span>.</> : "Not recorded. No session source is in this export."}
          </p>
        </section>
      </div>
    </div>
  );
}
