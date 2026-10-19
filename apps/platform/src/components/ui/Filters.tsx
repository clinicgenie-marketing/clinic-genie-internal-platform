import type { ReactNode } from "react";
import { Button } from "./Button";

/** GET form so filters live in the URL and can be shared or bookmarked. */
export function FilterBar({ children, action }: { children: ReactNode; action?: string }) {
  return (
    <form method="get" action={action} className="card p-3 mb-4 flex flex-wrap items-end gap-3">
      {children}
      <Button type="submit" variant="secondary" size="sm">Apply</Button>
    </form>
  );
}

export function FilterSelect({ name, label, value, options, allLabel = "All" }: { name: string; label: string; value?: string; options: Array<{ value: string; label: string }>; allLabel?: string }) {
  return (
    <label className="text-xs font-medium text-muted flex flex-col gap-1">
      {label}
      <select name={name} defaultValue={value ?? ""} className="rounded-md border border-line-strong bg-surface px-2 py-1.5 text-sm text-ink min-h-9 min-w-36">
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function FilterInput({ name, label, value, type = "text", placeholder }: { name: string; label: string; value?: string; type?: string; placeholder?: string }) {
  return (
    <label className="text-xs font-medium text-muted flex flex-col gap-1">
      {label}
      <input name={name} type={type} defaultValue={value ?? ""} placeholder={placeholder} className="rounded-md border border-line-strong bg-surface px-2 py-1.5 text-sm text-ink min-h-9 min-w-36" />
    </label>
  );
}
