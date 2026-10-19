import type { TimelineEventType } from "@clinic-genie/contracts";
import type { Queryable } from "../client";

export interface TimelineInput {
  clientId: string;
  eventType: TimelineEventType;
  title: string;
  summary?: string | null;
  relatedType: string | null;
  relatedId: string | null;
  actorUserId: string | null;
  /** Stable key for the business event so a retried transaction cannot create a duplicate. */
  dedupeKey: string;
  occurredAt?: Date;
}

/** Writes a user-facing timeline event in the caller's transaction. Idempotent on dedupeKey. */
export async function recordTimeline(db: Queryable, input: TimelineInput): Promise<void> {
  await db.query(
    `insert into timeline_events (client_id, occurred_at, event_type, title, summary, related_type, related_id, actor_user_id, dedupe_key)
     values ($1, coalesce($2, now()), $3, $4, $5, $6, $7, $8, $9) on conflict (dedupe_key) do nothing`,
    [input.clientId, input.occurredAt ?? null, input.eventType, input.title, input.summary ?? null, input.relatedType, input.relatedId, input.actorUserId, input.dedupeKey],
  );
}

export interface TimelineRow {
  id: string;
  client_id: string;
  client_name: string;
  occurred_at: Date;
  event_type: TimelineEventType;
  title: string;
  summary: string | null;
  related_type: string | null;
  related_id: string | null;
  actor_name: string | null;
}

export async function listTimeline(db: Queryable, opts: { clientId?: string; eventTypes?: string[]; from?: string; to?: string; limit?: number } = {}): Promise<TimelineRow[]> {
  const { rows } = await db.query<TimelineRow>(
    `select t.id, t.client_id, c.name as client_name, t.occurred_at, t.event_type, t.title, t.summary, t.related_type, t.related_id, u.display_name as actor_name
     from timeline_events t join clients c on c.id = t.client_id left join staff_users u on u.id = t.actor_user_id
     where ($1::uuid is null or t.client_id = $1)
       and ($2::text[] is null or t.event_type = any($2))
       and ($3::text is null or (t.occurred_at at time zone 'Asia/Singapore')::date >= $3::date)
       and ($4::text is null or (t.occurred_at at time zone 'Asia/Singapore')::date <= $4::date)
     order by t.occurred_at desc limit $5`,
    [opts.clientId ?? null, opts.eventTypes?.length ? opts.eventTypes : null, opts.from ?? null, opts.to ?? null, opts.limit ?? 200],
  );
  return rows;
}
