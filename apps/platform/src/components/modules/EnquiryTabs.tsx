"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["/enquiries", "Enquiries"],
  ["/enquiries/notifications", "Notification status"],
] as const;

export function EnquiryTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Enquiry sections" className="mb-6 overflow-x-auto">
      <ul className="flex min-w-max gap-1">
        {TABS.map(([href, name]) => {
          const active = href === "/enquiries/notifications" ? pathname.startsWith(href) : pathname === "/enquiries" || (pathname.startsWith("/enquiries/") && !pathname.startsWith("/enquiries/notifications"));
          return (
            <li key={href}>
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
