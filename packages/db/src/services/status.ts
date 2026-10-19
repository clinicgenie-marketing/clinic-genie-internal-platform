import type { Queryable } from "../client";

export interface PlatformStatus {
  activeClients: number;
  activeStaff: number;
  openTasks: number;
  overdueTasks: number;
  pendingApprovals: number;
  openIssues: number;
  claimsUnderReview: number;
  lastBackup: { started_at: Date; finished_at: Date | null; outcome: string; target: string; artefact_ref: string | null; record_counts: Record<string, number> } | null;
  lastRestoreTest: { started_at: Date; finished_at: Date | null; outcome: string; target: string; record_counts: Record<string, number>; notes: string | null } | null;
}

/** Aggregates for the admin overview. Backup and recovery status come only from recorded runs. */
export async function platformStatus(db: Queryable, today: string): Promise<PlatformStatus> {
  const counts = await db.query<{ clients: number; staff: number; open_tasks: number; overdue: number; approvals: number; issues: number; claims: number }>(
    `select (select count(*)::int from clients where status = 'active') as clients,
            (select count(*)::int from staff_users where active) as staff,
            (select count(*)::int from tasks where status in ('open','in_progress','waiting')) as open_tasks,
            (select count(*)::int from tasks where status in ('open','in_progress') and due_date < $1::date) as overdue,
            (select count(*)::int from approvals where status = 'submitted') as approvals,
            (select count(*)::int from issues where status <> 'verified_closed') as issues,
            (select count(*)::int from medical_claims where status = 'under_review') as claims`,
    [today],
  );
  const backup = await db.query("select started_at, finished_at, outcome, target, artefact_ref, record_counts from backup_runs where kind = 'backup' order by started_at desc limit 1");
  const restore = await db.query("select started_at, finished_at, outcome, target, record_counts, notes from backup_runs where kind = 'restore_test' order by started_at desc limit 1");
  const c = counts.rows[0]!;
  return {
    activeClients: c.clients,
    activeStaff: c.staff,
    openTasks: c.open_tasks,
    overdueTasks: c.overdue,
    pendingApprovals: c.approvals,
    openIssues: c.issues,
    claimsUnderReview: c.claims,
    lastBackup: backup.rows[0] ?? null,
    lastRestoreTest: restore.rows[0] ?? null,
  };
}

export async function listBackupRuns(db: Queryable, limit = 20) {
  const { rows } = await db.query("select * from backup_runs order by started_at desc limit $1", [limit]);
  return rows as Array<{ id: string; kind: string; started_at: Date; finished_at: Date | null; outcome: string; target: string; artefact_ref: string | null; record_counts: Record<string, number>; notes: string | null }>;
}
