import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const control = "block w-full rounded-xl border border-line bg-surface px-3 py-2 text-base text-ink min-h-11 placeholder:text-muted/70 disabled:bg-surface-muted disabled:text-muted";

export function Field({ label, htmlFor, hint, error, required, children }: { label: string; htmlFor: string; hint?: ReactNode; error?: string | null; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium mb-1">
        {label} {required && <span className="text-bad" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && !error && <p id={`${htmlFor}-hint`} className="text-xs text-muted mt-1">{hint}</p>}
      {error && <p id={`${htmlFor}-error`} role="alert" className="text-xs text-bad mt-1">{error}</p>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${control} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={`${control} min-h-24 ${props.className ?? ""}`} />;
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${control} ${props.className ?? ""}`}>
      {children}
    </select>
  );
}

export function Checkbox({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm min-h-11 cursor-pointer">
      <input type="checkbox" {...props} className="size-4 accent-action" />
      {label}
    </label>
  );
}

export function FormError({ state }: { state: { ok: false; error: string } | { ok: true; message?: string } | null | undefined }) {
  if (!state) return null;
  if (state.ok) return state.message ? <p role="status" className="text-sm text-good bg-good-bg rounded-xl px-3 py-2">{state.message}</p> : null;
  return <p role="alert" className="text-sm text-bad bg-bad-bg rounded-xl px-3 py-2">{state.error}</p>;
}
