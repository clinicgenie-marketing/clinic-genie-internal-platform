"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { label } from "@/components/ui/Badge";

export type ChannelRow = { channel: string; current: number; previous: number | null };

const METRICS = [
  { id: "sessions", label: "Sessions" },
  { id: "visitors", label: "Visitors" },
] as const;

const SPLITS = [
  { id: "source", label: "traffic source" },
  { id: "category", label: "traffic category" },
  { id: "both", label: "source and category" },
] as const;

type MetricId = (typeof METRICS)[number]["id"];
type SplitId = (typeof SPLITS)[number]["id"];

const NAMES: Record<string, Record<SplitId, string>> = {
  organic_search: { source: "Google", category: "Organic", both: "Google (Organic)" },
  paid_search: { source: "Google", category: "Paid", both: "Google (Paid)" },
  direct: { source: "Direct", category: "Direct", both: "Direct" },
  referral: { source: "Referral", category: "Referral", both: "Referral" },
  social: { source: "Social", category: "Social", both: "Social" },
  email: { source: "Email", category: "Email", both: "Email" },
};

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

function percentOf(current: number, previous: number | null) {
  if (previous === null || previous === 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function grouped(rows: ChannelRow[], split: SplitId) {
  const buckets = new Map<string, { current: number; previous: number | null }>();
  for (const row of rows) {
    const name = NAMES[row.channel]?.[split] ?? label(row.channel);
    const existing = buckets.get(name);
    if (!existing) {
      buckets.set(name, { current: row.current, previous: row.previous });
      continue;
    }
    existing.current += row.current;
    existing.previous = existing.previous === null || row.previous === null ? null : existing.previous + row.previous;
  }
  return [...buckets.entries()]
    .map(([name, value]) => ({ name, current: value.current, percent: percentOf(value.current, value.previous) }))
    .sort((a, b) => b.current - a.current);
}

function FilterMenu<T extends string>({ label: current, options, value, open, onToggle, onSelect, menuLabel }: {
  label: string;
  options: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  open: boolean;
  onToggle: () => void;
  onSelect: (id: T) => void;
  menuLabel: string;
}) {
  return (
    <div className="relative">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={onToggle} className="inline-flex items-center gap-1 text-base font-semibold text-action">
        {current}
        <ChevronDown className="size-3.5" aria-hidden="true" />
      </button>
      {open && (
        <ul role="listbox" aria-label={menuLabel} className="absolute left-0 z-30 mt-1 min-w-44 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-[0_12px_32px_rgba(23,60,64,0.12)]">
          {options.map((option) => {
            const selected = option.id === value;
            return (
              <li key={option.id} role="presentation">
                <button type="button" role="option" aria-selected={selected} onClick={() => onSelect(option.id)} className={`block w-full px-4 py-2 text-left text-sm ${selected ? "bg-action font-medium text-white" : "text-ink hover:bg-brand-pale"}`}>
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function SourceBreakdown({ sessions, visitors, reportHref }: { sessions: ChannelRow[]; visitors: ChannelRow[]; reportHref: string }) {
  const root = useRef<HTMLElement>(null);
  const [metric, setMetric] = useState<MetricId>("sessions");
  const [split, setSplit] = useState<SplitId>("both");
  const [open, setOpen] = useState<"metric" | "split" | null>(null);
  const rows = grouped(metric === "sessions" ? sessions : visitors, split);
  const max = Math.max(...rows.map((row) => row.current), 1);
  const metricLabel = METRICS.find((item) => item.id === metric)?.label ?? "Sessions";
  const splitLabel = SPLITS.find((item) => item.id === split)?.label ?? "source and category";

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <section ref={root} className="card" aria-label={`${metricLabel} by ${splitLabel}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 pb-4 pt-5">
        <FilterMenu label={metricLabel} options={METRICS} value={metric} open={open === "metric"} onToggle={() => setOpen(open === "metric" ? null : "metric")} onSelect={(id) => { setMetric(id); setOpen(null); }} menuLabel="Measure" />
        <FilterMenu label={`by ${splitLabel}`} options={SPLITS} value={split} open={open === "split"} onToggle={() => setOpen(open === "split" ? null : "split")} onSelect={(id) => { setSplit(id); setOpen(null); }} menuLabel="Breakdown" />
      </div>
      {rows.length === 0 ? (
        <p className="px-5 pb-4 text-sm text-muted">{metric === "visitors" ? "Not recorded. Visitors are not split this way." : "No session export for this period."}</p>
      ) : (
        <ul className="space-y-4 px-5 pb-4">
          {rows.map((row, index) => (
            <li key={row.name}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-ink">{row.name}</span>
                <span className="inline-flex items-center gap-2">
                  <Move percent={row.percent} />
                  <span className="num min-w-8 text-right font-semibold">{new Intl.NumberFormat("en-SG", { maximumFractionDigits: 0 }).format(row.current)}</span>
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-pale">
                <div className="h-full rounded-full" style={{ width: `${Math.max(8, (row.current / max) * 100)}%`, background: index === 0 ? "#136c72" : "#8fd4d8" }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link href={reportHref} className="inline-flex px-5 pb-5 text-sm font-semibold text-action hover:underline">View Report</Link>
    </section>
  );
}
