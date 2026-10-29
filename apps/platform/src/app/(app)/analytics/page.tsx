import { AnalyticsShell, loadAnalytics, NoWebsites, UnavailableClient } from "@/components/modules/AnalyticsShell";
import { HomeDashboard } from "@/components/modules/HomeDashboard";
import { AnalyticsDetail } from "@/components/modules/AnalyticsDetail";
import { LiveOverview } from "@/components/modules/LiveReports";
import { analyticsLiveReports } from "@/lib/analytics-flag";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ client?: string; website?: string; range?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const { denied, view, rangeId, from, to, reportLinks } = await loadAnalytics(params.client, params.range, params.from, params.to, params.website);
  if (denied) return <UnavailableClient />;
  if (!view || !reportLinks) return <NoWebsites />;
  return (
    <AnalyticsShell view={view} range={rangeId} from={from} to={to}>
      {analyticsLiveReports() ? <LiveOverview view={view} /> : (
        <>
          <div className="mb-6">
            <HomeDashboard view={view} embedded reportLinks={reportLinks} />
          </div>
          <AnalyticsDetail view={view} />
        </>
      )}
    </AnalyticsShell>
  );
}
