"use client";

import { useState } from "react";
import { Clock, Eye, LogOut, MousePointerClick, Search } from "lucide-react";

type DimensionValue = { name: string; current: number };

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-SG", { maximumFractionDigits: Number.isInteger(value) ? 0 : 1 }).format(value);
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return minutes === 0 ? `${rest}s` : `${minutes}m ${rest}s`;
}

function formatPercentPoint(value: number): string {
  return `${new Intl.NumberFormat("en-SG", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`;
}

const PAGE_MEASURES = [
  { id: "visits", label: "Visits", icon: Eye, empty: "Not recorded. Visits are not split by page." },
  { id: "clicks", label: "Button clicks", icon: MousePointerClick, empty: "Not recorded. Button clicks are not split by page." },
  { id: "time", label: "Avg. time on page", icon: Clock, empty: "Not recorded. Time on page is not split by page." },
  { id: "exit", label: "Exit rate", icon: LogOut, empty: "Not recorded. Exit rate is not split by page." },
] as const;

export type PageLists = Record<(typeof PAGE_MEASURES)[number]["id"], DimensionValue[]>;

function pageText(measure: (typeof PAGE_MEASURES)[number]["id"], value: number) {
  if (measure === "time") return formatDuration(value);
  if (measure === "exit") return formatPercentPoint(value);
  return formatCount(value);
}

function Bars({ rows }: { rows: Array<{ name: string; text: string; value: number }> }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <ul className="space-y-4 pt-5">
      {rows.map((row, index) => (
        <li key={row.name}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium text-ink">{row.name}</span>
            <span className="num shrink-0 font-semibold">{row.text}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-pale">
            <div className="h-full rounded-full" style={{ width: `${Math.max(8, (row.value / max) * 100)}%`, background: index === 0 ? "#136c72" : "#8fd4d8" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TopPages({ pages }: { pages: PageLists }) {
  const [measure, setMeasure] = useState<(typeof PAGE_MEASURES)[number]["id"]>("visits");
  const [query, setQuery] = useState("");
  const current = PAGE_MEASURES.find((item) => item.id === measure) ?? PAGE_MEASURES[0];
  const needle = query.trim().toLowerCase();
  const rows = (pages[measure] ?? []).filter((page) => page.name.toLowerCase().includes(needle));
  return (
    <div className="grid min-h-72 md:grid-cols-[13rem_minmax(0,1fr)]">
      <div className="border-b border-line p-3 md:border-r md:border-b-0" role="tablist" aria-label="Top pages by">
        {PAGE_MEASURES.map((item) => {
          const Icon = item.icon;
          const selected = item.id === measure;
          return (
            <button key={item.id} type="button" role="tab" aria-selected={selected} onClick={() => setMeasure(item.id)} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium ${selected ? "bg-brand-pale text-ink" : "text-ink-soft hover:bg-brand-pale/70"}`}>
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="p-5">
        <label className="relative block">
          <span className="sr-only">Search for a page</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search for a page" className="min-h-10 w-full rounded-xl border border-line bg-surface pr-3 pl-9 text-sm text-ink outline-none placeholder:text-muted focus:border-action" />
        </label>
        {rows.length > 0 ? (
          <Bars rows={rows.map((page) => ({ name: page.name, value: page.current, text: pageText(measure, page.current) }))} />
        ) : (
          <p className="px-1 pt-8 text-sm text-muted">{needle ? `No pages match “${query.trim()}”.` : current.empty}</p>
        )}
      </div>
    </div>
  );
}

const FORM_SPLITS = [
  { id: "sources", label: "Traffic sources", empty: "Not recorded. Form submissions are not split by source." },
  { id: "locations", label: "Locations", empty: "Not recorded. Form submissions are not split by location." },
] as const;

export function FormSplit({ sources, locations }: { sources: DimensionValue[]; locations: DimensionValue[] }) {
  const [split, setSplit] = useState<(typeof FORM_SPLITS)[number]["id"]>("sources");
  const current = FORM_SPLITS.find((item) => item.id === split) ?? FORM_SPLITS[0];
  const rows = split === "sources" ? sources : locations;
  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Form submission split">
        {FORM_SPLITS.map((item) => {
          const selected = item.id === split;
          return (
            <button key={item.id} type="button" role="tab" aria-selected={selected} onClick={() => setSplit(item.id)} className={`rounded-full px-3 py-1.5 text-sm font-medium ${selected ? "bg-brand-pale text-ink" : "text-ink-soft hover:bg-brand-pale/70"}`}>
              {item.label}
            </button>
          );
        })}
      </div>
      {rows.length > 0 ? (
        <Bars rows={rows.map((row) => ({ name: row.name, value: row.current, text: formatCount(row.current) }))} />
      ) : (
        <p className="pt-6 text-sm text-muted">{current.empty}</p>
      )}
    </div>
  );
}
