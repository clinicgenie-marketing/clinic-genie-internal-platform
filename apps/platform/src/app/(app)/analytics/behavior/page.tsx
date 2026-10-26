import { AnalyticsShell, loadAnalytics, NoWebsites } from "@/components/modules/AnalyticsShell";
import { BehaviorBoard } from "@/components/modules/BehaviorBoard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Behavior Overview" };

export default async function BehaviorPage({ searchParams }: { searchParams: Promise<{ client?: string; range?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const { view, rangeId, from, to, reportLinks } = await loadAnalytics(params.client, params.range, params.from, params.to);
  if (!view || !reportLinks) return <NoWebsites />;
  return (
    <AnalyticsShell view={view} range={rangeId} from={from} to={to} title="Behavior Overview">
      <BehaviorBoard view={view} reportLinks={reportLinks} />
    </AnalyticsShell>
  );
}
