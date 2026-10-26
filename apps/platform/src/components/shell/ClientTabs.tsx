"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["", "Overview"],
  ["/approvals", "Approvals"],
  ["/reports", "Reports"],
  ["/timeline", "Timeline"],
  ["/profile", "Profile"],
] as const;

export function ClientTabs({ clientId }: { clientId: string }) {
  const pathname = usePathname();
  const base = `/clients/${clientId}`;
  return (
    <nav aria-label="Client sections" className="mb-6 -mx-4 overflow-x-auto px-4">
      <ul className="flex min-w-max gap-1">
        {TABS.map(([suffix, name]) => {
          const href = `${base}${suffix}`;
          const active = suffix === "" ? pathname === base : pathname.startsWith(href);
          return (
            <li key={suffix}>
              <Link href={href} aria-current={active ? "page" : undefined} className={`inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-medium ${active ? "bg-brand-pale text-ink" : "text-ink-soft hover:bg-brand-pale/70 hover:text-ink"}`}>
                {name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
