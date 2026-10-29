import Link from "next/link";
import { seoHref, type SeoContext } from "@/lib/seo-workspace";

const DESTINATIONS = [
  ["/seo", "SEO Overview", true],
  ["/seo/tasks", "Checklist & Tasks", false],
  ["/seo/pages", "Pages & Content", false],
  ["/seo/site-health", "Site Health", false],
  ["/seo/redirects", "URL Redirects", false],
  ["/seo/business-profile", "Google Business Profile", false],
  ["/seo/ai-visibility", "AI Visibility", false],
  ["/seo/reports", "Reports", false],
  ["/seo/settings", "Settings & Connections", false],
] as const;

export function SeoSubnav({ pathname, ctx }: { pathname: string; ctx: SeoContext }) {
  return (
    <nav aria-label="SEO sections" className="mb-5 -mx-4 overflow-x-auto px-4">
      <ul className="flex min-w-max gap-1">
        {DESTINATIONS.map(([href, title, exact]) => {
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link href={seoHref(href, ctx)} aria-current={active ? "page" : undefined} className={`inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-medium ${active ? "bg-brand-pale text-ink" : "text-ink-soft hover:bg-brand-pale/70 hover:text-ink"}`}>
                {title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SeoTabs({ pathname, ctx, tabs, current, extra }: { pathname: string; ctx: SeoContext; tabs: ReadonlyArray<readonly [string, string]>; current: string; extra?: Record<string, string | undefined> }) {
  return (
    <nav aria-label="Page sections" className="mb-5 -mx-4 overflow-x-auto px-4">
      <ul className="flex min-w-max gap-1 border-b border-line">
        {tabs.map(([id, title]) => {
          const active = current === id;
          return (
            <li key={id}>
              <Link href={seoHref(pathname, ctx, { ...extra, tab: id })} aria-current={active ? "page" : undefined} className={`inline-flex min-h-10 items-center border-b-2 px-3 text-sm font-medium ${active ? "border-action text-action" : "border-transparent text-ink-soft hover:text-ink"}`}>
                {title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
