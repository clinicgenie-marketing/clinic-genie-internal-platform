/**
 * Load seed for performance checks. Generates tens of thousands of synthetic rows with set-based SQL.
 * Never run against the demonstration database used by the team; point DATABASE_ADMIN_URL at a
 * separate database whose name contains "perf" (enforced below).
 */
import type pg from "pg";

export interface LoadProfile {
  clients: number;
  staff: number;
  tasksPerClient: number;
  approvalsPerClient: number;
  seoPagesPerClient: number;
  issuesPerClient: number;
  claimsPerClient: number;
  snapshotPeriods: number;
}

export const DEFAULT_LOAD: LoadProfile = { clients: 40, staff: 24, tasksPerClient: 120, approvalsPerClient: 30, seoPagesPerClient: 40, issuesPerClient: 40, claimsPerClient: 15, snapshotPeriods: 24 };

export async function seedLoad(pool: pg.Pool, profile: LoadProfile = DEFAULT_LOAD, log: (l: string) => void = () => {}): Promise<Record<string, number>> {
  const db = await pool.connect();
  const started = Date.now();
  try {
    await db.query("begin");
    await db.query("select set_config('app.context', 'service', true)");
    // Staff: first six mirror the demonstration accounts so the same sign-ins work.
    await db.query(`insert into staff_users (email, display_name, platform_role) values
      ('admin@example.invalid','Demo Admin','admin'),('manager@example.invalid','Demo Manager','manager'),
      ('specialist-a@example.invalid','Demo Specialist A','specialist'),('specialist-b@example.invalid','Demo Specialist B','specialist'),
      ('reviewer@example.invalid','Demo Reviewer','reviewer'),('readonly@example.invalid','Demo Read-only','read_only')
      on conflict (email) do nothing`);
    await db.query(`insert into staff_users (email, display_name, platform_role)
      select format('load-staff-%s@example.invalid', g), format('Load Staff %s', g), (array['specialist','specialist','specialist','reviewer','manager'])[1 + g % 5]
      from generate_series(1, $1) g on conflict (email) do nothing`, [profile.staff]);
    await db.query(`insert into clients (slug, name, status, owner_user_id, channels, is_synthetic, notes)
      select format('load-clinic-%s', g), format('Load Clinic %s (fictional)', g), 'active',
             (select id from staff_users where platform_role = 'specialist' order by email offset (g % 4) limit 1),
             array['website','seo','google_ads'], true, 'Load-test client. Synthetic.'
      from generate_series(1, $1) g`, [profile.clients]);
    // Every specialist and reviewer is a member of every fourth client; admin and manager see all anyway.
    await db.query(`insert into memberships (user_id, client_id)
      select u.id, c.id from staff_users u cross join clients c
      where u.platform_role in ('specialist','reviewer') and c.slug like 'load-clinic-%'
        and (('x' || substr(md5(u.id::text || c.id::text), 1, 8))::bit(32)::int % 4 = 0 or u.email in ('specialist-a@example.invalid','reviewer@example.invalid'))`);
    await db.query(`insert into websites (client_id, name, url, platform) select id, name || ' website', format('https://%s.example.invalid', slug), 'Wix' from clients where slug like 'load-clinic-%'`);
    await db.query(`insert into account_references (client_id, kind, label, external_identifier, url) select id, 'google_ads', 'Google Ads account', 'PLACEHOLDER', 'https://ads.google.com/' from clients where slug like 'load-clinic-%'`);

    const specialists = `(select array_agg(id) from staff_users where platform_role in ('specialist','manager','admin') and active)`;
    await db.query(`insert into tasks (client_id, title, description, owner_user_id, priority, status, due_date, waiting_on, follow_up_date, created_by, created_at, completed_at)
      select c.id, format('Load task %s for %s', g, c.name), 'Synthetic load task.',
             (${specialists})[1 + (g % array_length(${specialists}, 1))],
             (array['low','medium','high','critical'])[1 + g % 4],
             (array['open','in_progress','waiting','completed','cancelled','open'])[1 + g % 6],
             case when g % 6 = 2 then current_date + (g % 20) else current_date - 30 + (g % 60) end,
             case when g % 6 = 2 then 'Client contact' else null end,
             case when g % 6 = 2 then current_date - 5 + (g % 15) else null end,
             (${specialists})[1], now() - (g || ' hours')::interval,
             case when g % 6 = 3 then now() - (g || ' minutes')::interval else null end
      from clients c cross join generate_series(1, $1) g where c.slug like 'load-clinic-%'`, [profile.tasksPerClient]);
    await db.query(`insert into task_history (task_id, client_id, from_status, to_status, actor_user_id, note, created_at) select id, client_id, null, 'open', created_by, 'Task created', created_at from tasks where title like 'Load task %'`);
    await db.query(`insert into timeline_events (client_id, occurred_at, event_type, title, related_type, related_id, actor_user_id, dedupe_key) select client_id, created_at, 'task_created', 'Task created: ' || title, 'task', id, created_by, 'task_created:' || id from tasks where title like 'Load task %'`);

    await db.query(`insert into approvals (client_id, title, summary, request_type, status, requested_by, submitted_at, created_at)
      select c.id, format('Load approval %s', g), 'Synthetic.', (array['content','seo_change','ads_change','other'])[1 + g % 4],
             (array['draft','submitted','approved','changes_requested'])[1 + g % 4], (${specialists})[1], now() - (g || ' hours')::interval, now() - (g || ' hours')::interval
      from clients c cross join generate_series(1, $1) g where c.slug like 'load-clinic-%'`, [profile.approvalsPerClient]);
    await db.query(`with d as (
        insert into approval_decisions (approval_id, client_id, outcome, note, decided_by)
        select id, client_id, case status when 'approved' then 'approved' else 'changes_requested' end, 'Synthetic decision', (select id from staff_users where platform_role = 'manager' limit 1)
        from approvals where title like 'Load approval %' and status in ('approved','changes_requested') returning id, approval_id)
      update approvals a set current_decision_id = d.id from d where a.id = d.approval_id`);

    await db.query(`insert into seo_pages (client_id, website_id, page_path, page_title, primary_keyword, search_intent, content_status, mapping_flag, flag_note, next_review_on, created_by)
      select c.id, w.id, format('/service-%s', g), format('Service %s', g), format('service %s singapore', g), 'commercial',
             (array['planned','published','needs_update','in_review'])[1 + g % 4], (array['none','none','none','duplicate_target'])[1 + g % 4],
             case when g % 4 = 3 then 'Synthetic flag' else null end, current_date - 10 + (g % 40), (${specialists})[1]
      from clients c join websites w on w.client_id = c.id cross join generate_series(1, $1) g where c.slug like 'load-clinic-%'`, [profile.seoPagesPerClient]);
    await db.query(`insert into seo_changes (client_id, seo_page_id, change_type, before_value, after_value, reason, changed_by, changed_on)
      select client_id, id, 'title', 'before', 'after', 'Synthetic change', created_by, current_date - (random() * 60)::int from seo_pages where page_path like '/service-%'`);

    await db.query(`insert into ads_audits (client_id, title, period_start, period_end, scope, auditor_user_id, status)
      select c.id, format('Load audit %s', g), current_date - 60 - g * 30, current_date - 30 - g * 30, 'All campaigns', (${specialists})[1], case when g = 1 then 'open' else 'closed' end
      from clients c cross join generate_series(1, 6) g where c.slug like 'load-clinic-%'`);
    await db.query(`insert into ads_findings (audit_id, client_id, area, finding, severity, recommendation) select a.id, a.client_id, 'search_terms', format('Finding %s', g), (array['low','medium','high'])[1 + g % 3], 'Synthetic' from ads_audits a cross join generate_series(1, 4) g where a.title like 'Load audit %'`);
    await db.query(`insert into ads_changes (client_id, audit_id, scope, description, before_value, after_value, reason, responsible_user_id, implemented_on)
      select a.client_id, a.id, 'Campaign', format('Load change %s', g), 'x', 'y', 'Synthetic', a.auditor_user_id, a.period_end + g from ads_audits a cross join generate_series(1, 3) g where a.title like 'Load audit %'`);

    await db.query(`insert into issues (client_id, title, description, severity, status, owner_user_id, opened_by, opened_at)
      select c.id, format('Load issue %s', g), 'Synthetic.', (array['low','medium','high','critical'])[1 + g % 4],
             (array['open','investigating','resolved_pending_verification','verified_closed','reopened'])[1 + g % 5], (${specialists})[1], (${specialists})[1], now() - (g || ' hours')::interval
      from clients c cross join generate_series(1, $1) g where c.slug like 'load-clinic-%'`, [profile.issuesPerClient]);
    await db.query(`insert into issue_history (issue_id, client_id, from_status, to_status, actor_user_id, note) select id, client_id, null, 'open', opened_by, 'Issue opened' from issues where title like 'Load issue %'`);

    await db.query(`insert into medical_claims (client_id, claim_summary, status, created_by)
      select c.id, format('Load claim %s', g), (array['draft','under_review','approved','rejected'])[1 + g % 4], (${specialists})[1]
      from clients c cross join generate_series(1, $1) g where c.slug like 'load-clinic-%'`, [profile.claimsPerClient]);
    await db.query(`with w as (insert into claim_wordings (claim_id, client_id, version, wording, created_by) select id, client_id, 1, 'Synthetic wording', created_by from medical_claims where claim_summary like 'Load claim %' returning id, claim_id)
      update medical_claims m set current_wording_id = w.id from w where m.id = w.claim_id`);

    await db.query(`insert into report_snapshots (client_id, source, channel, metric, period_start, period_end, value, unit, entered_by)
      select c.id, 'clinic_records', 'all', m.metric, (date_trunc('month', current_date) - (p || ' months')::interval)::date,
             (date_trunc('month', current_date) - ((p - 1) || ' months')::interval - interval '1 day')::date,
             case when m.metric = 'patients' and p % 7 = 0 then null else (100 + (p * 7 + length(m.metric)) % 90)::numeric end, 'count', (${specialists})[1]
      from clients c cross join generate_series(1, $1) p cross join (values ('clicks'),('sessions'),('enquiries'),('confirmed_appointments'),('patients')) m(metric)
      where c.slug like 'load-clinic-%'`, [profile.snapshotPeriods]);

    await db.query(`insert into audit_events (actor_type, actor_user_id, action, target_type, target_id, client_id, outcome, metadata)
      select 'staff', created_by, 'task.create', 'task', id::text, client_id, 'success', '{"load":true}' from tasks where title like 'Load task %'`);
    await db.query("commit");
    const counts: Record<string, number> = {};
    for (const t of ["clients", "staff_users", "memberships", "tasks", "approvals", "seo_pages", "seo_changes", "issues", "medical_claims", "report_snapshots", "timeline_events", "audit_events"]) {
      counts[t] = Number((await db.query(`select count(*) as n from ${t}`)).rows[0].n);
    }
    await db.query("analyze");
    log(`Load seed complete in ${Math.round((Date.now() - started) / 1000)}s: ${JSON.stringify(counts)}`);
    return counts;
  } catch (err) {
    await db.query("rollback");
    throw err;
  } finally {
    db.release();
  }
}
