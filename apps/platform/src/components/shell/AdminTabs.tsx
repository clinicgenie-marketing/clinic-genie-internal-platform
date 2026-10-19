"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [["/admin", "Status"], ["/admin/users", "Users and roles"], ["/admin/audit", "Audit history"], ["/admin/backups", "Backups and recovery"]] as const;

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin sections" className="mb-6 overflow-x-auto">
      <ul className="flex gap-1 border-b border-line min-w-max">
        {TABS.map(([href, name]) => {
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <li key={href}><Link href={href} aria-current={active ? "page" : undefined} className={`inline-flex min-h-11 items-center px-3 text-sm font-medium border-b-2 -mb-px ${active ? "border-action text-action" : "border-transparent text-ink-soft hover:text-ink"}`}>{name}</Link></li>
          );
        })}
      </ul>
    </nav>
  );
}
