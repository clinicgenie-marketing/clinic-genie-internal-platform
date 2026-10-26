import { listAccountReferences, listClients, listSnapshots, listWebsites, type AccessProfile, type AccountReferenceRow, type SnapshotRow, type WebsiteRow } from "@clinic-genie/db";
import { staffTx } from "@/lib/db";
import { alignRecordedPeriod, latestUpdate, matchedPeriods, day, type PeriodWindow } from "@/lib/site-metrics";

export interface SiteView {
  clients: Array<{ id: string; name: string; referenceNumber: string | null }>;
  clientId: string;
  clientName: string;
  clientReference: string | null;
  clientSpecialty: string | null;
  enquiryOwnerName: string | null;
  notificationOwnerName: string | null;
  websiteUrl: string | null;
  snapshots: SnapshotRow[];
  references: AccountReferenceRow[];
  current?: PeriodWindow;
  previous?: PeriodWindow;
  updatedAt: Date | null;
}

export async function loadSiteView(access: AccessProfile, requestedId?: string, windows?: { current: PeriodWindow; previous: PeriodWindow }, exact = false): Promise<SiteView | null> {
  return staffTx(access, async (db) => {
    const clients = await listClients(db);
    if (clients.length === 0) return null;
    const recorded = await listSnapshots(db, { limit: 50000 });
    const withSessions = new Set(recorded.filter((row) => row.metric === "sessions").map((row) => row.client_id));
    const chosen = clients.find((client) => client.id === requestedId) ?? clients.find((client) => withSessions.has(client.id)) ?? clients[0]!;
    const snapshots = recorded.filter((row) => row.client_id === chosen.id);
    const websites = await listWebsites(db, chosen.id);
    const references = await listAccountReferences(db, chosen.id);
    const site = websites.find((item: WebsiteRow) => item.environment === "production" && item.url) ?? websites.find((item: WebsiteRow) => item.url);
    const periods = windows ? alignRecordedPeriod(snapshots, windows, exact) : matchedPeriods(snapshots);
    const inWindow = snapshots.filter((row) => {
      const start = day(row.period_start);
      const end = day(row.period_end);
      return (periods.current && start === periods.current.start && end === periods.current.end) || (periods.previous && start === periods.previous.start && end === periods.previous.end);
    });
    // #region agent log
    fetch("http://127.0.0.1:7777/ingest/d1e6aa15-e325-4576-8252-5cc7335c095b", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "4b5b07" }, body: JSON.stringify({ sessionId: "4b5b07", runId: "post-fix", hypothesisId: "F", location: "apps/platform/src/lib/site-view.ts:loadSiteView", message: "analytics period resolved", data: { requestedStart: windows?.current.start ?? null, requestedEnd: windows?.current.end ?? null, resolvedStart: periods.current?.start ?? null, resolvedEnd: periods.current?.end ?? null, aligned: "aligned" in periods ? periods.aligned : false, rowsInWindow: inWindow.length }, timestamp: Date.now() }) }).catch(() => {});
    // #endregion
    return {
      clients: clients.map((client) => ({ id: client.id, name: client.name, referenceNumber: client.reference_number })),
      clientId: chosen.id,
      clientName: chosen.name,
      clientReference: chosen.reference_number,
      clientSpecialty: chosen.specialty,
      enquiryOwnerName: chosen.enquiry_owner_name,
      notificationOwnerName: chosen.notification_owner_name,
      websiteUrl: site?.url ?? null,
      snapshots,
      references,
      current: periods.current,
      previous: periods.previous,
      updatedAt: latestUpdate(inWindow),
    };
  });
}
