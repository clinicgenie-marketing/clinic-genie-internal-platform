import Link from "next/link";
import type { ApprovalRow } from "@clinic-genie/db";
import { formatDateTime } from "@clinic-genie/db";
import { Badge, APPROVAL_TONE, label } from "@/components/ui/Badge";
import { Table, Td, Th } from "@/components/ui/Table";

export function ApprovalTable({ approvals, showClient = true }: { approvals: ApprovalRow[]; showClient?: boolean }) {
  return (
    <Table caption="Approvals">
      <thead>
        <tr>
          <Th>Request</Th>
          {showClient && <Th>Client</Th>}
          <Th>Type</Th>
          <Th>Requested by</Th>
          <Th>Status</Th>
          <Th>Current decision</Th>
          <Th>Updated</Th>
        </tr>
      </thead>
      <tbody>
        {approvals.map((a) => (
          <tr key={a.id} className="hover:bg-surface-muted/60">
            <Td><Link href={`/approvals/${a.id}`} className="font-medium text-action hover:underline">{a.title}</Link></Td>
            {showClient && <Td><Link href={`/clients/${a.client_id}`} className="hover:underline">{a.client_name}</Link></Td>}
            <Td>{label(a.request_type)}</Td>
            <Td>{a.requester_name}</Td>
            <Td><Badge tone={APPROVAL_TONE[a.status]}>{label(a.status)}</Badge></Td>
            <Td>{a.current_outcome ? <span>{label(a.current_outcome)} by {a.current_decided_by_name}<div className="text-xs text-muted">{formatDateTime(a.current_decided_at)}</div></span> : <span className="text-muted">None yet</span>}</Td>
            <Td className="whitespace-nowrap text-muted">{formatDateTime(a.updated_at)}</Td>
          </tr>
        ))}
        {approvals.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-muted">No approvals match.</td></tr>}
      </tbody>
    </Table>
  );
}
