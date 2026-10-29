import { AnalyticsShell, loadAnalytics, NoWebsites, UnavailableClient } from "@/components/modules/AnalyticsShell";
import { TrafficBoard } from "@/components/modules/TrafficBoard";
import { LiveTraffic } from "@/components/modules/LiveReports";
import { analyticsLiveReports } from "@/lib/analytics-flag";

export const dynamic = "force-dynamic";
export const metadata = { title: "Traffic" };

export default async function TrafficPage({ searchParams }: { searchParams: Promise<{ client?: string; website?: string; range?: string; from?: string; to?: string; tab?: string }> }) {
  const params = await searchParams;
  const { denied, view, rangeId, from, to, reportLinks } = await loadAnalytics(params.client, params.range, params.from, params.to, params.website);
  if (denied) return <UnavailableClient />;
  if (!view || !reportLinks) return <NoWebsites />;
  return (
    <AnalyticsShell view={view} range={rangeId} from={from} to={to} title="Traffic">
      {analyticsLiveReports() ? <LiveTraffic view={view} tab={params.tab} range={rangeId} from={from} to={to} /> : <TrafficBoard view={view} reportLinks={reportLinks} />}
    </AnalyticsShell>
  );
}
