import Link from "next/link";
import type { IssueRow } from "@clinic-genie/db";
import { formatDateTime } from "@clinic-genie/db";
import { Badge, ISSUE_TONE, SEVERITY_TONE, label } from "@/components/ui/Badge";
import { Table, Td, Th } from "@/components/ui/Table";

export function IssueTable({ issues, showClient = true }: { issues: IssueRow[]; showClient?: boolean }) {
  return (
    <Table caption="Issues">
      <thead><tr><Th>Issue</Th>{showClient && <Th>Client</Th>}<Th>Severity</Th><Th>Status</Th><Th>Owner</Th><Th>Opened</Th><Th>Verification</Th><Th align="right">Evidence</Th></tr></thead>
      <tbody>
        {issues.map((i) => (
          <tr key={i.id} className="hover:bg-surface-muted/60">
            <Td><Link href={`/issues/${i.id}`} className="font-medium text-action hover:underline">{i.title}</Link></Td>
            {showClient && <Td><Link href={`/clients/${i.client_id}`} className="hover:underline">{i.client_name}</Link></Td>}
            <Td><Badge tone={SEVERITY_TONE[i.severity]}>{label(i.severity)}</Badge></Td>
            <Td><Badge tone={ISSUE_TONE[i.status]}>{label(i.status)}</Badge></Td>
            <Td>{i.owner_name}</Td>
            <Td className="whitespace-nowrap text-muted">{formatDateTime(i.opened_at)}</Td>
            <Td>{i.verification_result ? <span>{label(i.verification_result)} by {i.verified_by_name}<div className="text-xs text-muted">{formatDateTime(i.verified_at)}</div></span> : <span className="text-muted">None</span>}</Td>
            <Td align="right">{i.evidence_count}</Td>
          </tr>
        ))}
        {issues.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-sm text-muted">No issues match.</td></tr>}
      </tbody>
    </Table>
  );
}
