import { randomBytes } from "node:crypto";
import pg from "pg";
import { canManageRegistry, type AccessProfile } from "@clinic-genie/db";

const STATUSES = ["new", "acknowledged", "closed"] as const;
export type SubmissionStatus = (typeof STATUSES)[number];

export interface SubmissionListItem {
  id: string;
  reference: string;
  clinicId: string;
  clinicName: string;
  formKey: string;
  submittedAt: Date;
  submitterName: string;
  status: SubmissionStatus;
  isSynthetic: boolean;
}

export interface SubmissionDetail extends SubmissionListItem {
  contactNumber: string;
  email: string | null;
  message: string | null;
  pagePath: string | null;
  reason: string;
  preferredDate: string | null;
  preferredTimeWindow: string | null;
  formVersion: number;
}

export interface SubmissionClinic {
  id: string;
  name: string;
}

export interface SubmissionList {
  connected: boolean;
  items: SubmissionListItem[];
  clinics: SubmissionClinic[];
}

const FORM_NAMES: Record<string, string> = {
  "appointment-enquiry": "Appointment enquiry",
  contact: "Contact",
};

export function formName(key: string): string {
  return FORM_NAMES[key] ?? key.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function submissionStatus(value: string | undefined): SubmissionStatus | undefined {
  return STATUSES.find((status) => status === value);
}

/** Null means every clinic. A list means only those website clinic ids. */
export function submissionClinicScope(access: AccessProfile): string[] | null {
  if (canManageRegistry(access)) return null;
  return access.memberships.map((membership) => membership.client_slug);
}

const globalForEnquiry = globalThis as unknown as { enquiryPool?: pg.Pool };

export async function enquiryConnection(): Promise<{ configured: boolean; reachable: boolean }> {
  const pool = enquiryPool();
  if (!pool) return { configured: false, reachable: false };
  try {
    await pool.query("select 1");
    return { configured: true, reachable: true };
  } catch {
    return { configured: true, reachable: false };
  }
}

function enquiryPool(): pg.Pool | null {
  const url = process.env.ENQUIRY_DATABASE_URL?.trim();
  if (!url) return null;
  if (!globalForEnquiry.enquiryPool) {
    globalForEnquiry.enquiryPool = new pg.Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 2000 });
  }
  return globalForEnquiry.enquiryPool;
}

async function readEnquiry<T>(query: string, params: unknown[]): Promise<T[] | null> {
  const pool = enquiryPool();
  if (!pool) return null;
  try {
    const result = await pool.query(query, params);
    return result.rows as T[];
  } catch {
    return null;
  }
}

interface ListRow {
  id: string;
  public_reference: string;
  clinic_id: string;
  clinic_name: string;
  form_key: string;
  created_at: Date;
  name: string;
  status: SubmissionStatus;
  is_synthetic: boolean;
}

interface DetailRow extends ListRow {
  form_version: number;
  contact_number: string;
  email: string | null;
  message: string | null;
  page_path: string | null;
  reason: string;
  preferred_date: string | null;
  preferred_time_window: string | null;
}

function toListItem(row: ListRow): SubmissionListItem {
  return {
    id: row.id,
    reference: row.public_reference,
    clinicId: row.clinic_id,
    clinicName: row.clinic_name,
    formKey: row.form_key,
    submittedAt: row.created_at,
    submitterName: row.name,
    status: row.status,
    isSynthetic: row.is_synthetic,
  };
}

export async function submissionStatusCounts(scope: string[] | null): Promise<{ connected: true; counts: Record<SubmissionStatus, number> } | { connected: false }> {
  const rows = await readEnquiry<{ status: SubmissionStatus; count: number }>(
    `select status, count(*)::int as count from enquiries
     where ($1::text[] is null or clinic_id = any($1))
     group by status`,
    [scope],
  );
  if (!rows) return { connected: false };
  const counts: Record<SubmissionStatus, number> = { new: 0, acknowledged: 0, closed: 0 };
  for (const row of rows) if (row.status in counts) counts[row.status] = Number(row.count);
  return { connected: true, counts };
}

export async function notificationAttention(scope: string[] | null): Promise<{ connected: true; pending: number; failed: number; unconfigured: number } | { connected: false }> {
  const rows = await readEnquiry<{ status: string; count: number }>(
    `select status, count(*)::int as count from notification_outbox
     where event_type = 'clinic_notification'
       and ($1::text[] is null or clinic_id = any($1))
     group by status`,
    [scope],
  );
  if (!rows) return { connected: false };
  const count = (status: string) => Number(rows.find((row) => row.status === status)?.count ?? 0);
  return { connected: true, pending: count("pending"), failed: count("failed") + count("exhausted"), unconfigured: count("unconfigured") };
}

export function submissionFormKey(value: string | undefined): string | undefined {
  return value && /^[a-z0-9-]{1,64}$/.test(value) ? value : undefined;
}

export async function listSubmissionForms(scope: string[] | null): Promise<Array<{ key: string; name: string }>> {
  const rows = await readEnquiry<{ form_key: string }>(
    `select distinct form_key from enquiries
     where ($1::text[] is null or clinic_id = any($1))
     order by form_key`,
    [scope],
  );
  return (rows ?? []).map((row) => ({ key: row.form_key, name: formName(row.form_key) }));
}

export async function listFormSubmissions(scope: string[] | null, filters: { clinicId?: string; status?: SubmissionStatus; formKey?: string }): Promise<SubmissionList> {
  const clinicId = filters.clinicId && (scope === null || scope.includes(filters.clinicId)) ? filters.clinicId : null;
  const formKey = submissionFormKey(filters.formKey);
  const rows = await readEnquiry<ListRow>(
    `select e.id, e.public_reference, e.clinic_id, c.display_name as clinic_name, e.form_key, e.created_at, e.name, e.status, e.is_synthetic
     from enquiries e
     join clinics c on c.id = e.clinic_id
     where ($1::text[] is null or e.clinic_id = any($1))
       and ($2::text is null or e.clinic_id = $2)
       and ($3::text is null or e.status = $3)
       and ($4::text is null or e.form_key = $4)
     order by e.created_at desc
     limit 200`,
    [scope, clinicId, filters.status ?? null, formKey ?? null],
  );
  if (!rows) return { connected: false, items: [], clinics: [] };
  const clinics = await readEnquiry<{ id: string; display_name: string }>(
    `select c.id, c.display_name
     from clinics c
     where exists (select 1 from enquiries e where e.clinic_id = c.id)
       and ($1::text[] is null or c.id = any($1))
     order by c.display_name`,
    [scope],
  );
  return {
    connected: true,
    items: rows.map(toListItem),
    clinics: (clinics ?? []).map((clinic) => ({ id: clinic.id, name: clinic.display_name })),
  };
}

export async function getFormSubmission(scope: string[] | null, id: string): Promise<SubmissionDetail | null | "unavailable"> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const rows = await readEnquiry<DetailRow>(
    `select e.id, e.public_reference, e.clinic_id, c.display_name as clinic_name, e.form_key, e.form_version, e.created_at, e.name, e.status, e.is_synthetic,
            e.contact_number, e.email, e.message, e.page_path, e.reason, e.preferred_date::text as preferred_date, e.preferred_time_window
     from enquiries e
     join clinics c on c.id = e.clinic_id
     where e.id = $1
       and ($2::text[] is null or e.clinic_id = any($2))`,
    [id, scope],
  );
  if (!rows) return "unavailable";
  const row = rows[0];
  if (!row) return null;
  return {
    ...toListItem(row),
    formVersion: row.form_version,
    contactNumber: row.contact_number,
    email: row.email,
    message: row.message,
    pagePath: row.page_path,
    reason: row.reason,
    preferredDate: row.preferred_date,
    preferredTimeWindow: row.preferred_time_window,
  };
}

const NOTIFICATION_STATUSES = ["pending", "sent", "failed", "exhausted", "unconfigured"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export interface NotificationRow {
  id: string;
  enquiryId: string;
  clinicId: string;
  clinicName: string;
  reference: string;
  status: NotificationStatus;
  attempts: number;
  errorCode: string | null;
  updatedAt: Date;
}

export function canRetryNotifications(access: AccessProfile): boolean {
  return access.user.platform_role === "admin" || access.user.platform_role === "manager" || access.user.platform_role === "specialist";
}

export async function listNotifications(scope: string[] | null): Promise<{ connected: true; items: NotificationRow[] } | { connected: false }> {
  const rows = await readEnquiry<{
    id: string;
    enquiry_id: string;
    clinic_id: string;
    clinic_name: string;
    public_reference: string;
    status: NotificationStatus;
    attempts: number;
    last_error_code: string | null;
    updated_at: Date;
  }>(
    `select o.id, o.enquiry_id, o.clinic_id, c.display_name as clinic_name, e.public_reference, o.status, o.attempts, o.last_error_code, o.updated_at
     from notification_outbox o
     join clinics c on c.id = o.clinic_id
     join enquiries e on e.id = o.enquiry_id
     where o.event_type = 'clinic_notification'
       and ($1::text[] is null or o.clinic_id = any($1))
     order by o.updated_at desc
     limit 200`,
    [scope],
  );
  if (!rows) return { connected: false };
  return {
    connected: true,
    items: rows.map((row) => ({
      id: row.id,
      enquiryId: row.enquiry_id,
      clinicId: row.clinic_id,
      clinicName: row.clinic_name,
      reference: row.public_reference,
      status: row.status,
      attempts: Number(row.attempts),
      errorCode: row.last_error_code,
      updatedAt: row.updated_at,
    })),
  };
}

/** Puts an existing failed notification back to pending. Does not create an enquiry. */
export async function retryNotification(scope: string[] | null, id: string): Promise<{ id: string; clinicId: string } | null | "unavailable"> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const pool = enquiryPool();
  if (!pool) return "unavailable";
  try {
    const result = await pool.query<{ id: string; clinic_id: string }>(
      `update notification_outbox
       set status = 'pending', next_attempt_at = now(), leased_until = null, updated_at = now()
       where id = $1
         and event_type = 'clinic_notification'
         and status in ('failed', 'exhausted')
         and ($2::text[] is null or clinic_id = any($2))
       returning id, clinic_id`,
      [id, scope],
    );
    const row = result.rows[0];
    return row ? { id: row.id, clinicId: row.clinic_id } : null;
  } catch {
    return "unavailable";
  }
}

/** Stores one labelled synthetic enquiry. Returns the new id and reference, or why it was not stored. */
export async function createTestSubmission(clinicId: string): Promise<{ id: string; reference: string } | "not_connected" | "rejected"> {
  const pool = enquiryPool();
  if (!pool) return "not_connected";
  if (!/^[a-z0-9-]{1,64}$/.test(clinicId)) return "rejected";
  const reference = `TEST-${randomBytes(5).toString("hex").toUpperCase()}`;
  const idempotencyKey = `test-${randomBytes(12).toString("hex")}`;
  try {
    const result = await pool.query<{ id: string }>(
      `insert into enquiries (
         public_reference, clinic_id, form_key, form_version, idempotency_key, payload_digest,
         name, contact_number, reason, notice_version, consent_acknowledged_at, is_synthetic
       ) values ($1, $2, 'appointment-enquiry', 1, $3, 'test', 'Test submission', '00000000', 'Test submission', 'test', now(), true)
       returning id`,
      [reference, clinicId, idempotencyKey],
    );
    const id = result.rows[0]?.id;
    return id ? { id, reference } : "rejected";
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23503" || code === "23514" || code === "23505") return "rejected";
    return "not_connected";
  }
}
