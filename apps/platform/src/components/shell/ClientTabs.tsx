"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["", "Overview"],
  ["/tasks", "Tasks"],
  ["/approvals", "Approvals"],
  ["/seo", "SEO"],
  ["/google-ads", "Google Ads"],
  ["/issues", "Issues"],
  ["/medical-review", "Medical review"],
  ["/reports", "Reports"],
  ["/timeline", "Timeline"],
  ["/profile", "Profile"],
] as const;

export function ClientTabs({ clientId }: { clientId: string }) {
  const pathname = usePathname();
  const base = `/clients/${clientId}`;
  return (
    <nav aria-label="Client sections" className="mb-6 -mx-4 px-4 overflow-x-auto">
      <ul className="flex gap-1 border-b border-line min-w-max">
        {TABS.map(([suffix, name]) => {
          const href = `${base}${suffix}`;
          const active = suffix === "" ? pathname === base : pathname.startsWith(href);
          return (
            <li key={suffix}>
              <Link href={href} aria-current={active ? "page" : undefined} className={`inline-flex min-h-11 items-center px-3 text-sm font-medium border-b-2 -mb-px ${active ? "border-action text-action" : "border-transparent text-ink-soft hover:text-ink hover:border-line-strong"}`}>
                {name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
