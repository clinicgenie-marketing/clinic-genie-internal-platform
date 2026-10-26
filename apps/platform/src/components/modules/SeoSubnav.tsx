import Link from "next/link";

const TABS = [
  ["/seo", "Overview"],
  ["/seo/settings", "Page settings"],
  ["/seo/redirects", "301 redirects"],
  ["/seo/checklist", "Setup checklist"],
  ["/seo/business-profiles", "Google Business Profile"],
] as const;

export function SeoSubnav({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="SEO sections" className="mb-6 -mx-4 overflow-x-auto px-4">
      <ul className="flex min-w-max gap-1">
        {TABS.map(([href, title]) => {
          const active = href === "/seo" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className={`inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-medium ${active ? "bg-brand-pale text-ink" : "text-ink-soft hover:bg-brand-pale/70 hover:text-ink"}`}>
                {title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
