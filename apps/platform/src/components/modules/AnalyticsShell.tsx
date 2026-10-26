import type { ReactNode } from "react";
import { requireAccess } from "@/lib/session";
import { loadSiteView, type SiteView } from "@/lib/site-view";
import { customWindow, formatCompared, periodRange } from "@/lib/period-range";
import { periodRangeId, type PeriodRangeId } from "@/lib/period-options";
import { breakdownLinks, type BreakdownLinks } from "@/lib/report-link";
import { SiteHeader } from "@/components/modules/SiteHeader";
import { AnalyticsSubnav } from "@/components/modules/AnalyticsSubnav";
import { EmptyState } from "@/components/ui/Notice";

export async function loadAnalytics(client?: string, range?: string, from?: string, to?: string) {
  const access = await requireAccess();
  const requested = periodRangeId(range);
  const custom = requested === "custom" ? customWindow(from, to) : null;
  const rangeId: PeriodRangeId = custom ? "custom" : requested === "custom" ? "last30" : requested;
  const view = await loadSiteView(access, client, custom ?? periodRange(rangeId), Boolean(custom));
  const reportLinks: BreakdownLinks | null = view ? breakdownLinks(view.clientId, rangeId, custom?.current.start, custom?.current.end) : null;
  return { rangeId, from: custom?.current.start, to: custom?.current.end, view, reportLinks };
}

export function NoWebsites() {
  return <EmptyState title="No websites yet">Analytics appear here once a client website is on the platform.</EmptyState>;
}

export function AnalyticsShell({ view, range, from, to, title = "Analytics", children }: { view: SiteView; range: PeriodRangeId; from?: string; to?: string; title?: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader
        title={title}
        clients={view.clients}
        clientId={view.clientId}
        clientName={view.clientName}
        clientReference={view.clientReference}
        clientSpecialty={view.clientSpecialty}
        websiteUrl={view.websiteUrl}
        current={view.current}
        previous={view.previous}
        updatedAt={view.updatedAt}
        range={range}
        from={from}
        to={to}
        comparedLabel={view.previous ? formatCompared(view.previous) : undefined}
      />
      <AnalyticsSubnav clientId={view.clientId} range={range} from={from} to={to} />
      {children}
    </>
  );
}
