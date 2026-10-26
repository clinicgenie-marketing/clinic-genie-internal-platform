import { canEditClient, listClients, REPORT_SECTION_KEYS } from "@clinic-genie/db";
import { requireAccess } from "@/lib/session";
import { staffTx } from "@/lib/db";
import { PageHeader } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { SavedReportEditor } from "@/components/modules/SavedReportEditor";
import { clientLabel } from "@/lib/client-label";

export const dynamic = "force-dynamic";
export const metadata = { title: "New report" };

export default async function NewReportPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const access = await requireAccess();
  const { client } = await searchParams;
  const clients = await staffTx(access, (db) => listClients(db));
  const editable = clients.filter((item) => canEditClient(access, item.id));
  return (
    <>
      <PageHeader title="Create a report" description="Set the period, sections and commentary. Saving keeps version 1 for client review. Preview is available after the report is created." />
      {editable.length === 0 ? <Notice tone="neutral">You cannot create a report.</Notice> : (
        <SavedReportEditor
          readOnly={false}
          clients={editable.map((item) => ({ id: item.id, label: clientLabel(item) }))}
          draft={{
            clientId: editable.some((item) => item.id === client) ? client! : "",
            name: "",
            periodStart: "",
            periodEnd: "",
            comparisonStart: "",
            comparisonEnd: "",
            sections: [...REPORT_SECTION_KEYS],
            summary: "",
            observations: "",
            actionsTaken: "",
            nextSteps: "",
            dataSourcesNote: "",
            missingConnections: "",
            measurementLimitations: "",
          }}
        />
      )}
    </>
  );
}
