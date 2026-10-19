"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Menu, X, LayoutDashboard, ListChecks, Building2, CheckSquare, Search, Megaphone, AlertTriangle, Stethoscope, BarChart3, History, Shield } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
}

const ICONS = { LayoutDashboard, ListChecks, Building2, CheckSquare, Search, Megaphone, AlertTriangle, Stethoscope, BarChart3, History, Shield };

function NavGroup({ title, items, pathname }: { title: string; items: NavItem[]; pathname: string }) {
  if (!items.length) return null;
  return (
    <div className="mb-5">
      <div className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</div>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-md px-3 min-h-10 text-sm font-medium transition-colors ${active ? "bg-surface text-action shadow-card" : "text-ink-soft hover:bg-brand-pale-strong/60 hover:text-ink"}`}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Shell({ workspace, modules, platform, header, children }: { workspace: NavItem[]; modules: NavItem[]; platform: NavItem[]; header: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    // Close the mobile menu after navigation without an effect.
    setLastPath(pathname);
    setOpen(false);
  }

  const nav = (
    <nav aria-label="Main" className="px-3 py-4">
      <NavGroup title="Workspace" items={workspace} pathname={pathname} />
      <NavGroup title="Work modules" items={modules} pathname={pathname} />
      <NavGroup title="Platform" items={platform} pathname={pathname} />
    </nav>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-surface focus:px-3 focus:py-2 focus:rounded-md">Skip to main content</a>
      <aside className="hidden lg:flex lg:flex-col bg-brand-pale border-r border-line sticky top-0 h-dvh overflow-y-auto">
        <div className="flex items-center gap-3 px-5 h-16 border-b border-line/70">
          <img src="/brandmark.svg" alt="" width={28} height={28} />
          <span className="font-semibold">Clinic Genie</span>
        </div>
        {nav}
      </aside>
      {open && (
        <div className="lg:hidden fixed inset-0 z-40">
          <button className="absolute inset-0 bg-ink/50" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-brand-pale overflow-y-auto shadow-pop" aria-label="Main menu">
            <div className="flex items-center justify-between px-4 h-16 border-b border-line/70">
              <span className="font-semibold flex items-center gap-2"><img src="/brandmark.svg" alt="" width={24} height={24} />Clinic Genie</span>
              <button className="inline-flex size-11 items-center justify-center rounded-md" aria-label="Close menu" onClick={() => setOpen(false)}>
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}
      <div className="flex min-h-dvh flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/95 backdrop-blur px-4">
          <button className="lg:hidden inline-flex size-11 items-center justify-center rounded-md hover:bg-surface-muted" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <span className="lg:hidden font-semibold">Clinic Genie</span>
          <div className="ml-auto flex items-center gap-3 min-w-0">{header}</div>
        </header>
        <main id="main" className="flex-1 px-4 py-6 lg:px-8 max-w-[1400px] w-full">{children}</main>
      </div>
    </div>
  );
}
