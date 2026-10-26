"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { analyticsSearch } from "@/lib/period-options";

const LINKS = [
  { href: "/analytics", label: "Overview", exact: true },
  { href: "/analytics/traffic", label: "Traffic", exact: false },
  { href: "/analytics/behavior", label: "Behavior", exact: false },
] as const;

export function AnalyticsSubnav({ clientId, range, from, to }: { clientId: string; range: string; from?: string; to?: string }) {
  const pathname = usePathname();
  const query = `?${analyticsSearch(clientId, range, from, to)}`;
  return (
    <nav aria-label="Analytics sections" className="mb-6 overflow-x-auto">
      <ul className="flex min-w-max gap-1">
        {LINKS.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link href={`${link.href}${query}`} aria-current={active ? "page" : undefined} className={`inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-medium ${active ? "bg-brand-pale text-ink" : "text-ink-soft hover:bg-brand-pale/70 hover:text-ink"}`}>
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
