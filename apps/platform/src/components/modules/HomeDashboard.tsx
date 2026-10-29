import Link from "next/link";
import { ChevronDown, ChevronUp, FileCheck, Mail, MessageCircle, MousePointerClick, Phone, Users } from "lucide-react";
import { formatDateTime, formatPeriod } from "@clinic-genie/db";
import { label } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { ClientPicker } from "./ClientPicker";
import { channelsFor, formatCount, formatMove, pairMetric, type MetricPair } from "@/lib/site-metrics";
import type { SiteView } from "@/lib/site-view";
import type { BreakdownLinks } from "@/lib/report-link";

const SERIES = ["#136c72", "#8fd4d8", "#173c40", "#5b7479"];

function recorded(view: SiteView) {
  const periods = { current: view.current, previous: view.previous };
  const manual = (metric: string) => pairMetric(view.snapshots, periods, metric, "manual", "all");
  return {
    sessions: pairMetric(view.snapshots, periods, "sessions", "ga4_export"),
    enquiries: pairMetric(view.snapshots, periods, "enquiries", "clinic_records", "all"),
    whatsapp: manual("contact_whatsapp"),
    phone: manual("contact_phone"),
    email: manual("contact_email"),
    booking: manual("contact_booking"),
    visitors: manual("unique_visitors"),
    pageViews: manual("page_views"),
    postViews: manual("post_views"),
    contactClicks: manual("contact_clicks"),
    formSubmissions: manual("form_submissions"),
    sources: channelsFor(view.snapshots, view.current, "sessions", "ga4_export", view.previous),
  };
}

function statDetail(pair: MetricPair, meaning: string) {
  if (pair.previous === null || pair.current === null) return meaning;
  return `Previous period ${formatCount(pair.previous)}. ${meaning}`;
}

function sparkSeries(previous: number, current: number, seed: number) {
  const steps = 14;
  const rise = current - previous;
  const wave = Math.max(Math.abs(rise) * 0.28, Math.max(previous, current, 1) * 0.08);
  return Array.from({ length: steps }, (_, index) => {
    if (index === 0) return previous;
    if (index === steps - 1) return current;
    const progress = index / (steps - 1);
    const base = previous + rise * progress;
    const bend = Math.sin(index * 0.9 + seed * 1.4) * 0.72 + Math.sin(index * 1.7 + seed * 0.6) * 0.28;
    return Math.max(0, base + bend * wave);
  });
}

function sparkPath(points: Array<[number, number]>) {
  const first = points[0];
  if (!first) return "";
  let path = `M ${first[0].toFixed(1)} ${first[1].toFixed(1)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const before = points[Math.max(index - 1, 0)]!;
    const current = points[index]!;
    const next = points[index + 1]!;
    const after = points[Math.min(index + 2, points.length - 1)]!;
    const control1 = [current[0] + (next[0] - before[0]) / 6, current[1] + (next[1] - before[1]) / 6];
    const control2 = [next[0] - (after[0] - current[0]) / 6, next[1] - (after[1] - current[1]) / 6];
    path += ` C ${control1[0]!.toFixed(1)} ${control1[1]!.toFixed(1)}, ${control2[0]!.toFixed(1)} ${control2[1]!.toFixed(1)}, ${next[0]!.toFixed(1)} ${next[1]!.toFixed(1)}`;
  }
  return path;
}

function Spark({ previous, current, seed }: { previous: number | null; current: number | null; seed: number }) {
  if (previous === null || current === null) return null;
  const values = sparkSeries(previous, current, seed);
  const min = Math.min(...values);
  const max = Math.max(...values, min + 1);
  const y = (value: number) => 23 - ((value - min) / (max - min)) * 18;
  const points = values.map((value, index) => [4 + (index / (values.length - 1)) * 88, y(value)] as [number, number]);
  return (
    <svg viewBox="0 0 96 28" className="h-7 w-24 shrink-0" role="img" aria-label={`Previous ${formatCount(previous)}, current ${formatCount(current)}`}>
      <path d={sparkPath(points)} fill="none" stroke="#136c72" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function KeyStat({ label, value, percent, previous, current, detail, seed }: { label: string; value: string; percent: number | null; previous: number | null; current: number | null; detail: string; seed: number }) {
  const tone = percent === null ? "" : percent < 0 ? "text-bad" : "text-good";
  return (
    <article className="flex h-full flex-col rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_var(--color-line)]">
      <p className="text-sm text-ink-soft">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <p className="num text-3xl font-semibold tracking-tight">{value}</p>
          {percent !== null && <p className={`text-sm font-semibold ${tone}`}>{formatMove(percent)}</p>}
        </div>
        <Spark previous={previous} current={current} seed={seed} />
      </div>
      <p className="mt-auto pt-2 text-xs text-muted">{detail}</p>
    </article>
  );
}

function MiniBars({ previous, current }: { previous: number | null; current: number | null }) {
  const max = Math.max(previous ?? 0, current ?? 0, 1);
  const height = (value: number | null) => (value === null ? 6 : Math.max(10, Math.round((value / max) * 52)));
  return (
    <div className="flex items-end gap-1.5" aria-hidden="true">
      <span className="w-2.5 rounded-sm bg-white/35" style={{ height: height(previous) }} />
      <span className="w-2.5 rounded-sm bg-white" style={{ height: height(current) }} />
    </div>
  );
}

function TrendChart({ series }: { series: Array<{ name: string; previous: number | null; current: number | null }> }) {
  const sessionValues = series.flatMap((item) => [item.previous, item.current]).filter((value): value is number => value !== null);
  if (sessionValues.length === 0) {
    return <p className="px-5 pb-6 text-sm text-muted">No session export for these two periods.</p>;
  }
  const width = 560;
  const height = 248;
  const pad = { l: 46, r: 16, t: 22, b: 32 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const maxSessions = Math.max(...sessionValues) * 1.18;
  const y = (value: number) => pad.t + plotH - (value / maxSessions) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((step) => Math.round((maxSessions * step) / 10) * 10);
  const barW = 28;
  const innerGap = 10;
  const groupW = series.length * barW + (series.length - 1) * innerGap;
  const centers = [plotW * 0.32, plotW * 0.72];
  const groups = [
    { label: "Previous", values: series.map((item) => item.previous) },
    { label: "Current", values: series.map((item) => item.current) },
  ];

  return (
    <div className="px-3 pb-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full" role="img" aria-label="Sessions by source for the previous and current periods">
        <defs>
          <pattern id="dash-stripe" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <rect width="6" height="6" fill="#ddf7f8" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#136c72" strokeWidth="2.5" />
          </pattern>
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.l} x2={width - pad.r} y1={y(tick)} y2={y(tick)} stroke="#e4eef0" />
            <text x={pad.l - 8} y={y(tick) + 4} textAnchor="end" className="fill-muted" fontSize="11">{tick}</text>
          </g>
        ))}
        {groups.map((group, groupIndex) => {
          const left = pad.l + centers[groupIndex]! - groupW / 2;
          return (
            <g key={group.label}>
              {group.values.map((value, index) => {
                if (value === null) return null;
                const x = left + index * (barW + innerGap);
                const top = y(value);
                return (
                  <g key={series[index]!.name}>
                    <rect x={x} y={top} width={barW} height={pad.t + plotH - top} rx="6" fill={index === 1 ? "url(#dash-stripe)" : SERIES[index % SERIES.length]} />
                    <text x={x + barW / 2} y={top - 6} textAnchor="middle" className="fill-ink-soft" fontSize="11">{formatCount(value)}</text>
                  </g>
                );
              })}
              <text x={pad.l + centers[groupIndex]!} y={height - 8} textAnchor="middle" className="fill-ink-soft" fontSize="12">{group.label}</text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 px-3 text-xs text-ink-soft">
        {series.map((item, index) => (
          <span key={item.name} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: index === 1 ? "#8fd4d8" : SERIES[index % SERIES.length] }} />
            {item.name}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Sessions by source</caption>
        <thead><tr><th>Source</th><th>Previous</th><th>Current</th></tr></thead>
        <tbody>
          {series.map((item) => (
            <tr key={item.name}><td>{item.name}</td><td>{formatCount(item.previous)}</td><td>{formatCount(item.current)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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

function SourceBars({ parts, reportHref }: { parts: Array<{ name: string; current: number; percent: number | null }>; reportHref: string }) {
  const max = Math.max(...parts.map((part) => part.current), 1);
  return (
    <div className="flex flex-1 flex-col px-5 pb-5">
      {parts.length === 0 ? (
        <p className="text-sm text-muted">No session export by source for this period.</p>
      ) : (
        <ul className="space-y-4">
          {parts.map((part, index) => {
            const down = part.percent !== null && part.percent < 0;
            return (
              <li key={part.name}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-ink">{part.name}</span>
                  <span className="inline-flex items-center gap-2">
                    {part.percent !== null && (
                      <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${down ? "text-bad" : "text-good"}`}>
                        {down ? <ChevronDown className="size-3.5" aria-hidden="true" /> : <ChevronUp className="size-3.5" aria-hidden="true" />}
                        <span className="sr-only">{down ? "Down" : "Up"} </span>
                        {Math.abs(part.percent)}%
                      </span>
                    )}
                    {part.percent !== null && <span className="h-3.5 w-px bg-line" aria-hidden="true" />}
                    <span className="num min-w-8 text-right font-semibold">{formatCount(part.current)}</span>
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-pale">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(8, (part.current / max) * 100)}%`, background: index === 0 ? "#136c72" : "#8fd4d8" }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 text-xs text-muted">Sessions only. Contact clicks and form submissions are not split by source.</p>
      <Link href={reportHref} className="mt-auto pt-4 text-sm font-semibold text-action hover:underline">View Report</Link>
    </div>
  );
}

const panel = "card";

export function HomeDashboard({ view, embedded = false, reportLinks }: { view: SiteView; embedded?: boolean; reportLinks: BreakdownLinks }) {
  const figures = recorded(view);
  const analyticsHref = `/analytics?client=${encodeURIComponent(view.clientId)}`;
  const ga4 = view.references.find((item) => item.kind === "ga4");
  const search = view.references.find((item) => item.kind === "search_console");
  const move = formatMove(figures.sessions.percent);
  const series = figures.sources.length
    ? figures.sources.map((source) => ({ name: label(source.channel), previous: source.previous, current: source.current }))
    : figures.sessions.current === null && figures.sessions.previous === null
      ? []
      : [{ name: "Sessions", previous: figures.sessions.previous, current: figures.sessions.current }];
  const range = view.current ? formatPeriod(view.current.start, view.current.end, " – ") : "No recorded period";
  const compared = view.previous ? formatPeriod(view.previous.start, view.previous.end, " – ") : null;
  const contacts = [
    { name: "WhatsApp clicks", icon: MessageCircle, pair: figures.whatsapp },
    { name: "Phone clicks", icon: Phone, pair: figures.phone },
    { name: "Email clicks", icon: Mail, pair: figures.email },
    { name: "Booking-link clicks", icon: MousePointerClick, pair: figures.booking },
  ];

  return (
    <div className="space-y-5">
      {!embedded && (
        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              {view.clientReference ? `${view.clientReference} · ` : ""}{view.clientName}{view.clientSpecialty ? ` · ${view.clientSpecialty}` : ""}
              {view.websiteUrl ? <> · <Link href={view.websiteUrl} className="font-medium text-action hover:underline">Open website</Link></> : null}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <ClientPicker clients={view.clients} value={view.clientId} label="Clinic" />
              <LinkButton href={analyticsHref} size="sm">View analytics</LinkButton>
            </div>
          </div>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-3 text-xs text-muted">
            <span>{range}{compared ? ` compared with ${compared}` : ""}</span>
            <span>{view.updatedAt ? `Last updated ${formatDateTime(view.updatedAt)}` : "No export has been recorded"}</span>
          </p>
        </div>
      )}

      <section aria-labelledby="key-stats">
        <h2 id="key-stats" className="sr-only">Key statistics</h2>
        <div className="grid items-stretch gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:grid-rows-[1fr_1fr] xl:grid-cols-[repeat(4,minmax(0,1fr))] xl:grid-rows-[1fr]">
        <article className="relative flex h-full flex-col overflow-hidden rounded-3xl bg-action p-5 text-white shadow-[0_12px_28px_rgba(19,108,114,0.28)]">
          <div className="pointer-events-none absolute -right-6 -top-8 size-28 rounded-full bg-white/10" />
          <div className="flex items-start justify-between gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-white/15"><Users className="size-5" aria-hidden="true" /></span>
            {move && <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">{move}</span>}
          </div>
          <p className="mt-4 text-sm text-white/80">Site sessions</p>
          <p className="num mt-1 text-4xl font-semibold tracking-tight">{formatCount(figures.sessions.current)}</p>
          <div className="mt-4 flex items-end justify-between gap-3">
            <p className="max-w-[14rem] text-xs leading-relaxed text-white/75">{figures.sessions.previous === null ? "No earlier session export." : `Previous period ${formatCount(figures.sessions.previous)}. A session is not a unique visitor.`}</p>
            <MiniBars previous={figures.sessions.previous} current={figures.sessions.current} />
          </div>
        </article>
        {[
          { name: "Unique visitors", pair: figures.visitors, hint: "One person. This is not the same measure as a session.", icon: Users },
          { name: "Contact clicks", pair: figures.contactClicks, hint: "A call, message, email or booking link. Not a stored enquiry.", icon: MousePointerClick },
          { name: "Successful form submissions", pair: figures.formSubmissions, hint: "Counted only after a form is saved. Contact clicks are separate.", icon: FileCheck },
        ].map((item) => (
          <article key={item.name} className={`${panel} flex h-full flex-col p-5`}>
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-brand-pale text-action"><item.icon className="size-5" aria-hidden="true" /></span>
              {formatMove(item.pair.percent) && <span className={`text-xs font-semibold ${item.pair.percent !== null && item.pair.percent < 0 ? "text-bad" : "text-good"}`}>{formatMove(item.pair.percent)}</span>}
            </div>
            <p className="mt-4 text-sm text-muted">{item.name}</p>
            <p className={item.pair.current === null ? "mt-1 text-2xl font-semibold tracking-tight text-ink-soft" : "num mt-1 text-4xl font-semibold tracking-tight"}>{formatCount(item.pair.current)}</p>
            <p className="mt-auto pt-3 text-xs leading-relaxed text-muted">{statDetail(item.pair, item.hint)}</p>
          </article>
        ))}
        </div>
      </section>

      <section aria-labelledby="recorded-stats">
        <h2 id="recorded-stats" className="mb-3 text-sm font-medium text-ink">
          Your key stats for <span className="font-semibold text-action">{range}</span>
        </h2>
        <div className="grid items-stretch gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:grid-rows-[1fr_1fr_1fr] xl:grid-cols-[repeat(3,minmax(0,1fr))] xl:grid-rows-[1fr_1fr]">
          <KeyStat label="Site sessions" value={formatCount(figures.sessions.current)} percent={figures.sessions.percent} previous={figures.sessions.previous} current={figures.sessions.current} seed={2} detail={statDetail(figures.sessions, figures.sessions.previous === null && figures.sessions.current === null ? "No earlier session export. A session is not a unique visitor." : "A session is not a unique visitor.")} />
          <KeyStat label="Clicks to contact" value={formatCount(figures.contactClicks.current)} percent={figures.contactClicks.percent} previous={figures.contactClicks.previous} current={figures.contactClicks.current} seed={5} detail={statDetail(figures.contactClicks, "A call, message, email or booking link. Not a stored enquiry.")} />
          <KeyStat label="Form submissions" value={formatCount(figures.formSubmissions.current)} percent={figures.formSubmissions.percent} previous={figures.formSubmissions.previous} current={figures.formSubmissions.current} seed={8} detail={figures.formSubmissions.current === null && figures.enquiries.current !== null ? `Stored enquiries this period: ${formatCount(figures.enquiries.current)}. That total is not a form-completion count.` : statDetail(figures.formSubmissions, "Counted only after a form is saved. Contact clicks are separate.")} />
          <KeyStat label="Unique visitors" value={formatCount(figures.visitors.current)} percent={figures.visitors.percent} previous={figures.visitors.previous} current={figures.visitors.current} seed={11} detail={statDetail(figures.visitors, "One person. This is not the same measure as a session.")} />
          <KeyStat label="Page views" value={formatCount(figures.pageViews.current)} percent={figures.pageViews.percent} previous={figures.pageViews.previous} current={figures.pageViews.current} seed={6} detail={statDetail(figures.pageViews, figures.pageViews.current === null ? "Not in the recorded export." : "Pages opened during the period.")} />
          <KeyStat label="Post views" value={formatCount(figures.postViews.current)} percent={figures.postViews.percent} previous={figures.postViews.previous} current={figures.postViews.current} seed={9} detail={statDetail(figures.postViews, figures.postViews.current === null ? "Not in the recorded export." : "Article and post pages opened during the period.")} />
        </div>
      </section>

      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className={`${panel} h-full`} aria-labelledby="trend">
          <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-5">
            <div>
              <h2 id="trend" className="text-base font-semibold">Performance trend</h2>
              <p className="mt-0.5 text-xs text-muted">Two recorded periods. This is not a daily chart. Page-level sessions are not recorded.</p>
            </div>
          </div>
          <TrendChart series={series} />
        </section>
        <section className={`${panel} h-full`} aria-labelledby="attention">
          <div className="px-5 pb-2 pt-5">
            <h2 id="attention" className="text-base font-semibold">Needs attention</h2>
            <p className="mt-0.5 text-xs text-muted">{range}</p>
          </div>
          <ul className="space-y-3 px-5 pb-4 text-sm">
            <li className="rounded-2xl bg-warn-bg px-3 py-3 text-warn">
              <p className="font-medium">Analytics is not a live connection</p>
              <p className="mt-1 text-xs leading-relaxed">{ga4 ? `A ${ga4.label} reference is saved${ga4.owner_name ? `. ${ga4.owner_name} looks after it` : ""}. It does not refresh visitor counts.` : "No analytics reference is saved for this website."}</p>
            </li>
            <li className="rounded-2xl bg-brand-pale px-3 py-3 text-ink">
              <p className="font-medium">Search is not a live connection</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">{search ? `A ${search.label} reference is saved${search.owner_name ? `. ${search.owner_name} looks after it` : ""}. Queries and landing pages are not in the export.` : "No Search Console reference is saved."}</p>
            </li>
            <li className="rounded-2xl bg-surface-muted px-3 py-3">
              <p className="font-medium">Form notifications</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{view.notificationOwnerName ? `${view.notificationOwnerName} looks after notification issues. ` : ""}Failed and recovered notifications are not copied here.</p>
            </li>
          </ul>
          <p className="px-5 pb-5 text-xs leading-relaxed text-muted">Enquiry events stay in the protected list. This dashboard shows no names, email addresses, phone numbers or messages.</p>
        </section>
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <section className={`${panel} flex h-full flex-col`} aria-labelledby="sources">
          <h2 id="sources" className="px-5 pb-4 pt-5 text-base font-semibold">Top traffic sources</h2>
          <SourceBars
            parts={[...figures.sources]
              .sort((a, b) => b.current - a.current)
              .map((source) => ({
                name: sourceName(source.channel),
                current: source.current,
                percent: source.previous === null || source.previous === 0 ? null : Number((((source.current - source.previous) / source.previous) * 100).toFixed(1)),
              }))}
            reportHref={reportLinks.sources}
          />
        </section>
        <section className={`${panel} h-full`} aria-labelledby="contacts">
          <h2 id="contacts" className="px-5 pb-1 pt-5 text-base font-semibold">Contact actions</h2>
          <p className="px-5 text-xs text-muted">Clicks, not stored enquiries and not appointments.</p>
          <ul className="mt-3 divide-y divide-line/80 px-2 pb-3">
            {contacts.map((item) => (
              <li key={item.name} className="flex items-center justify-between gap-3 px-3 py-3 text-sm">
                <span className="inline-flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-brand-pale text-action"><item.icon className="size-4" aria-hidden="true" /></span>
                  {item.name}
                </span>
                <span className={item.pair.current === null ? "text-xs font-medium text-muted" : "num text-sm font-semibold"}>{formatCount(item.pair.current)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className={`${panel} h-full`} aria-labelledby="enquiries">
          <h2 id="enquiries" className="px-5 pb-1 pt-5 text-base font-semibold">Enquiry overview</h2>
          <p className="px-5 text-xs text-muted">{view.enquiryOwnerName ? `${view.enquiryOwnerName} looks after enquiries. ` : ""}Counts only. Names and messages stay off this dashboard.</p>
          <p className="num px-5 pt-4 text-4xl font-semibold tracking-tight">{formatCount(figures.enquiries.current)}</p>
          <p className="px-5 text-xs text-muted">{formatMove(figures.enquiries.percent) ? `${formatMove(figures.enquiries.percent)} vs previous period` : "Recorded enquiries this period"}</p>
          <ul className="mt-4 space-y-2 px-5 pb-5 text-sm">
            <li className="flex items-center justify-between rounded-2xl bg-surface-muted px-3 py-3"><span>Previous period</span><span className="num font-semibold">{formatCount(figures.enquiries.previous)}</span></li>
            <li className="flex items-center justify-between gap-3 rounded-2xl bg-surface-muted px-3 py-3"><span>Awaiting acknowledgement</span><span className="shrink-0 text-xs text-muted">Not listed here</span></li>
            <li className="flex items-center justify-between gap-3 rounded-2xl bg-surface-muted px-3 py-3"><span>Closed enquiries</span><span className="shrink-0 text-xs text-muted">Not listed here</span></li>
          </ul>
        </section>
      </div>
    </div>
  );
}
