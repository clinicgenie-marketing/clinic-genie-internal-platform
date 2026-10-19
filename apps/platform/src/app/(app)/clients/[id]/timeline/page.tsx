import { listTimeline } from "@clinic-genie/db";
import { requireClientAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { TimelineList } from "@/components/modules/TimelineList";

export const dynamic = "force-dynamic";

export default async function ClientTimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireClientAccess(id);
  const events = await staffTx(access, (db) => listTimeline(db, { clientId: id, limit: 300 }));
  return <Card><TimelineList events={events} showClient={false} /></Card>;
}
