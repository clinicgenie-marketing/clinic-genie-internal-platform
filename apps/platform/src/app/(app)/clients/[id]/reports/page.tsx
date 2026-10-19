import { requireClientAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { ReportsModule, type ReportParams } from "@/components/modules/ReportsModule";

export const dynamic = "force-dynamic";

export default async function ClientReportsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<ReportParams> }) {
  const { id } = await params;
  const sp = await searchParams;
  const access = await requireClientAccess(id);
  return staffTx(access, (db) => ReportsModule({ db, access, clientId: id, params: sp, action: `/clients/${id}/reports` }));
}
