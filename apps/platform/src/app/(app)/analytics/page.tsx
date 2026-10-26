import { HomeDashboard } from "@/components/modules/HomeDashboard";
import { AnalyticsDetail } from "@/components/modules/AnalyticsDetail";
import { AnalyticsShell, loadAnalytics, NoWebsites } from "@/components/modules/AnalyticsShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ client?: string; range?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const { view, rangeId, from, to, reportLinks } = await loadAnalytics(params.client, params.range, params.from, params.to);
  if (!view || !reportLinks) return <NoWebsites />;
  return (
    <AnalyticsShell view={view} range={rangeId} from={from} to={to}>
      <div className="mb-6">
        <HomeDashboard view={view} embedded reportLinks={reportLinks} />
      </div>
      <AnalyticsDetail view={view} />
    </AnalyticsShell>
  );
}
