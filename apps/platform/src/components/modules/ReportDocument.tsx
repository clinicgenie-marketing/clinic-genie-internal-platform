import { REPORT_SECTIONS } from "@clinic-genie/contracts";
import { formatDateTime, formatPeriod, type SavedFigure } from "@clinic-genie/db";
import { label } from "@/components/ui/Badge";
import { Table, Td, Th } from "@/components/ui/Table";

const SOURCE_LABEL: Record<string, string> = {
  ga4_export: "Analytics export",
  search_console_export: "Search Console export",
  google_ads_export: "Google Ads export",
  clinic_records: "Clinic enquiry records",
  manual: "Manual entry",
  other: "Other",
};

function figureText(value: number | null, unit: string, status: string): string {
  if (value === null) return status === "not_recorded" ? "Not recorded" : "Unavailable";
  return unit === "sgd" ? `SGD ${value.toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : value.toLocaleString("en-SG");
}

function changeText(figure: SavedFigure, compared: boolean): string {
  if (!compared) return "";
  if (figure.percentChange !== null) return `${figure.percentChange > 0 ? "+" : ""}${figure.percentChange}%`;
  if (figure.status === "zero_baseline") return "Zero baseline, no %";
  if (figure.status === "not_recorded") return "Not recorded";
  return "Not shown";
}

export function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] ?? label(source);
}

export function ReportDocument({
  name,
  clientName,
  periodStart,
  periodEnd,
  comparisonStart,
  comparisonEnd,
  sections,
  figures,
  summary,
  observations,
  actionsTaken,
  nextSteps,
  dataSources,
  dataSourcesNote,
  lastRefresh,
  missingConnections,
  missingNote,
  limitationNote,
  measurementLimitations,
  caption,
}: {
  name: string;
  clientName: string;
  periodStart: string;
  periodEnd: string;
  comparisonStart: string | null;
  comparisonEnd: string | null;
  sections: string[];
  figures: SavedFigure[];
  summary: string | null;
  observations: string | null;
  actionsTaken: string | null;
  nextSteps: string | null;
  dataSources: string[];
  dataSourcesNote: string | null;
  lastRefresh: Date | null;
  missingConnections: string[];
  missingNote: string | null;
  limitationNote: string | null;
  measurementLimitations: string | null;
  caption?: string;
}) {
  const compared = Boolean(comparisonStart && comparisonEnd);
  return (
    <div className="space-y-6">
      {caption && <p className="text-sm text-muted">{caption}</p>}
      <div>
        <h3 className="text-lg font-semibold">{name}</h3>
        <p className="mt-1 text-sm text-muted">
          {clientName} · {formatPeriod(periodStart, periodEnd, " to ")}
          {compared ? ` · compared with ${formatPeriod(comparisonStart!, comparisonEnd!, " to ")}` : ""}
        </p>
      </div>
      {sections.map((key) => {
        const section = REPORT_SECTIONS.find((item) => item.key === key);
        const rows = figures.filter((figure) => figure.section === key);
        if (!section) return null;
        return (
          <section key={key} id={key} className="scroll-mt-28">
            <h4 className="text-sm font-semibold">{section.label}</h4>
            <Table caption={section.label}>
              <thead>
                <tr>
                  <Th>Metric</Th>
                  {compared && <Th align="right">Comparison</Th>}
                  <Th align="right">Reporting period</Th>
                  {compared && <Th align="right">Change</Th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((figure) => (
                  <tr key={figure.metric}>
                    <Td>{figure.label}</Td>
                    {compared && <Td align="right">{figureText(figure.previous, figure.unit, figure.status)}</Td>}
                    <Td align="right">{figureText(figure.current, figure.unit, figure.status)}</Td>
                    {compared && <Td align="right">{changeText(figure, compared)}</Td>}
                  </tr>
                ))}
              </tbody>
            </Table>
          </section>
        );
      })}
      <section className="space-y-3 text-sm">
        <h4 className="font-semibold">Written commentary</h4>
        <Commentary label="Summary" text={summary} />
        <Commentary label="Observations" text={observations} />
        <Commentary label="Actions taken" text={actionsTaken} />
        <Commentary label="Proposed next steps" text={nextSteps} />
      </section>
      <section className="space-y-2 text-sm">
        <h4 className="font-semibold">Data notes</h4>
        <p><span className="font-medium">Data sources. </span>{dataSources.length ? dataSources.map(sourceLabel).join(", ") : "Not recorded"}{dataSourcesNote ? `. ${dataSourcesNote}` : ""}</p>
        <p><span className="font-medium">Last refresh. </span>{lastRefresh ? formatDateTime(lastRefresh) : "Not recorded"}</p>
        <p><span className="font-medium">Missing connections. </span>{missingConnections.length ? missingConnections.map(sourceLabel).join(", ") : "None recorded for this period"}{missingNote ? `. ${missingNote}` : ""}</p>
        <p><span className="font-medium">Measurement limitations. </span>{[limitationNote, measurementLimitations].filter(Boolean).join(" ") || "Not recorded"}</p>
      </section>
    </div>
  );
}

function Commentary({ label: title, text }: { label: string; text: string | null }) {
  return (
    <p className="whitespace-pre-wrap">
      <span className="font-medium">{title}. </span>
      {text || <span className="text-muted">Not written</span>}
    </p>
  );
}
