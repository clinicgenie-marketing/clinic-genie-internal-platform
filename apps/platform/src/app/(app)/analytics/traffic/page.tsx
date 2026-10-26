import { AnalyticsShell, loadAnalytics, NoWebsites } from "@/components/modules/AnalyticsShell";
import { TrafficBoard } from "@/components/modules/TrafficBoard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Traffic Overview" };

export default async function TrafficPage({ searchParams }: { searchParams: Promise<{ client?: string; range?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const { view, rangeId, from, to, reportLinks } = await loadAnalytics(params.client, params.range, params.from, params.to);
  if (!view || !reportLinks) return <NoWebsites />;
  return (
    <AnalyticsShell view={view} range={rangeId} from={from} to={to} title="Traffic Overview">
      <TrafficBoard view={view} reportLinks={reportLinks} />
    </AnalyticsShell>
  );
}
