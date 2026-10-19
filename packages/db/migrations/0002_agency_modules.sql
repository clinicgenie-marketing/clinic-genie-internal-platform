-- 0002 Agency operations modules: tasks, approvals, SEO, Google Ads, issues and evidence, medical review, reports, timeline.
-- Every row carries client_id so row-level security and membership checks apply uniformly.

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create table tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id),
  title text not null check (length(title) between 1 and 200),
  description text,
  owner_user_id uuid not null references staff_users (id),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting', 'completed', 'cancelled')),
  due_date date,
  waiting_on text,
  follow_up_date date,
  related_type text,
  related_id uuid,
  created_by uuid not null references staff_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  constraint tasks_high_critical_need_due_date check (priority not in ('high', 'critical') or due_date is not null),
  constraint tasks_waiting_needs_details check (status <> 'waiting' or (waiting_on is not null and length(waiting_on) > 0 and follow_up_date is not null)),
  constraint tasks_related_pair check ((related_type is null) = (related_id is null))
);
create index tasks_client_status_idx on tasks (client_id, status);
create index tasks_owner_idx on tasks (owner_user_id) where status in ('open', 'in_progress', 'waiting');
create index tasks_due_idx on tasks (due_date) where status in ('open', 'in_progress', 'waiting');

create table task_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id),
  client_id uuid not null references clients (id),
  from_status text,
  to_status text not null,
  from_owner_user_id uuid references staff_users (id),
  to_owner_user_id uuid references staff_users (id),
  actor_user_id uuid not null references staff_users (id),
  note text,
  created_at timestamptz not null default now()
);
create index task_history_task_idx on task_history (task_id, created_at);
create trigger task_history_no_update before update on task_history for each row execute function block_mutation();
create trigger task_history_no_delete before delete on task_history for each row execute function block_mutation();

create table task_notes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id),
  client_id uuid not null references clients (id),
  author_user_id uuid not null references staff_users (id),
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index task_notes_task_idx on task_notes (task_id, created_at);

-- ---------------------------------------------------------------------------
-- Approvals: the request is mutable until submitted; decisions are append-only
-- ---------------------------------------------------------------------------
create table approvals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id),
  title text not null check (length(title) between 1 and 200),
  summary text,
  request_type text not null check (request_type in ('content', 'seo_change', 'ads_change', 'medical_claim', 'website_change', 'other')),
  related_type text,
  related_id uuid,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'changes_requested', 'withdrawn')),
  requested_by uuid not null references staff_users (id),
  submitted_at timestamptz,
  withdrawn_at timestamptz,
  current_decision_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approvals_related_pair check ((related_type is null) = (related_id is null))
);
create index approvals_client_status_idx on approvals (client_id, status);

create table approval_decisions (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null references approvals (id),
  client_id uuid not null references clients (id),
  outcome text not null check (outcome in ('approved', 'changes_requested')),
  note text,
  decided_by uuid not null references staff_users (id),
  decided_at timestamptz not null default now(),
  supersedes_decision_id uuid references approval_decisions (id),
  superseded_at timestamptz
);
create index approval_decisions_approval_idx on approval_decisions (approval_id, decided_at);

-- A decision may only ever gain a superseded_at timestamp. Nothing else changes.
create or replace function approval_decisions_guard() returns trigger
language plpgsql as $$
begin
  if old.superseded_at is not null
     or new.outcome <> old.outcome or new.note is distinct from old.note or new.decided_by <> old.decided_by
     or new.decided_at <> old.decided_at or new.approval_id <> old.approval_id or new.client_id <> old.client_id
     or new.supersedes_decision_id is distinct from old.supersedes_decision_id or new.superseded_at is null then
    raise exception 'approval_decisions is append-only' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
create trigger approval_decisions_guard_update before update on approval_decisions for each row execute function approval_decisions_guard();
create trigger approval_decisions_no_delete before delete on approval_decisions for each row execute function block_mutation();

-- ---------------------------------------------------------------------------
-- SEO content and search mapping
-- ---------------------------------------------------------------------------
create table seo_pages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id),
  website_id uuid references websites (id),
  page_path text not null check (length(page_path) between 1 and 500),
  page_title text,
  primary_keyword text,
  secondary_keywords text[] not null default '{}',
  search_intent text check (search_intent in ('informational', 'navigational', 'commercial', 'transactional')),
  content_status text not null default 'planned' check (content_status in ('planned', 'drafting', 'in_review', 'published', 'needs_update', 'retired')),
  owner_user_id uuid references staff_users (id),
  last_reviewed_on date,
  next_review_on date,
  mapping_flag text not null default 'none' check (mapping_flag in ('none', 'duplicate_target', 'cannibalisation', 'missing_page', 'wrong_intent', 'thin_content', 'other')),
  flag_note text,
  notes text,
  created_by uuid not null references staff_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index seo_pages_client_idx on seo_pages (client_id) where archived_at is null;

create or replace function seo_pages_check_website() returns trigger
language plpgsql as $$
begin
  if new.website_id is not null and not exists (select 1 from websites w where w.id = new.website_id and w.client_id = new.client_id) then
    raise exception 'website does not belong to this client' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger seo_pages_website_trg before insert or update on seo_pages for each row execute function seo_pages_check_website();

create table seo_changes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id),
  seo_page_id uuid not null references seo_pages (id),
  change_type text not null check (change_type in ('title', 'meta_description', 'heading', 'body_content', 'internal_links', 'keyword_target', 'url', 'schema', 'other')),
  before_value text,
  after_value text,
  reason text not null,
  changed_by uuid not null references staff_users (id),
  changed_on date not null,
  approval_id uuid references approvals (id),
  verification_on date,
  verified_by uuid references staff_users (id),
  outcome_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index seo_changes_page_idx on seo_changes (seo_page_id, changed_on desc);
create index seo_changes_client_idx on seo_changes (client_id, changed_on desc);

-- ---------------------------------------------------------------------------
-- Google Ads audit and change log (records of work; never touches a live account)
-- ---------------------------------------------------------------------------
create table ads_audits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id),
  account_reference_id uuid references account_references (id),
  title text not null check (length(title) between 1 and 200),
  period_start date not null,
  period_end date not null,
  scope text not null,
  summary text,
  auditor_user_id uuid not null references staff_users (id),
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ads_audits_period check (period_end >= period_start)
);
create index ads_audits_client_idx on ads_audits (client_id, period_end desc);

create table ads_findings (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references ads_audits (id),
  client_id uuid not null references clients (id),
  area text not null check (area in ('campaign', 'ad_group', 'keywords', 'search_terms', 'ads', 'landing_pages', 'budget', 'bidding', 'conversion_tracking', 'other')),
  finding text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  recommendation text,
  status text not null default 'open' check (status in ('open', 'implemented', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ads_findings_audit_idx on ads_findings (audit_id);

create table ads_changes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id),
  audit_id uuid references ads_audits (id),
  finding_id uuid references ads_findings (id),
  scope text not null,
  description text not null,
  before_value text,
  after_value text,
  reason text not null,
  responsible_user_id uuid not null references staff_users (id),
  approval_id uuid references approvals (id),
  implemented_on date not null,
  verification_on date,
  verified_by uuid references staff_users (id),
  outcome_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ads_changes_client_idx on ads_changes (client_id, implemented_on desc);

-- ---------------------------------------------------------------------------
-- Issue register, verification and evidence
-- ---------------------------------------------------------------------------
create table issues (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id),
  title text not null check (length(title) between 1 and 200),
  description text,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved_pending_verification', 'verified_closed', 'reopened')),
  owner_user_id uuid not null references staff_users (id),
  opened_by uuid not null references staff_users (id),
  opened_at timestamptz not null default now(),
  related_type text,
  related_id uuid,
  resolution_note text,
  resolved_at timestamptz,
  resolved_by uuid references staff_users (id),
  verified_by uuid references staff_users (id),
  verified_at timestamptz,
  verification_result text check (verification_result in ('passed', 'failed')),
  reopen_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint issues_related_pair check ((related_type is null) = (related_id is null))
);
create index issues_client_status_idx on issues (client_id, status);

create table issue_history (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references issues (id),
  client_id uuid not null references clients (id),
  from_status text,
  to_status text not null,
  actor_user_id uuid not null references staff_users (id),
  note text,
  verification_result text check (verification_result in ('passed', 'failed')),
  created_at timestamptz not null default now()
);
create index issue_history_issue_idx on issue_history (issue_id, created_at);
create trigger issue_history_no_update before update on issue_history for each row execute function block_mutation();
create trigger issue_history_no_delete before delete on issue_history for each row execute function block_mutation();

create table evidence_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id),
  issue_id uuid references issues (id),
  related_type text,
  related_id uuid,
  kind text not null check (kind in ('upload', 'link')),
  label text not null check (length(label) between 1 and 200),
  url text check (url is null or url ~ '^https://'),
  storage_key text,
  original_name text,
  mime_type text,
  size_bytes bigint,
  sha256 text,
  uploaded_by uuid not null references staff_users (id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint evidence_kind_fields check (
    (kind = 'link' and url is not null and storage_key is null) or
    (kind = 'upload' and storage_key is not null and url is null)
  )
);
create index evidence_items_client_idx on evidence_items (client_id) where deleted_at is null;
create index evidence_items_issue_idx on evidence_items (issue_id) where deleted_at is null;

create or replace function evidence_check_issue_client() returns trigger
language plpgsql as $$
begin
  if new.issue_id is not null and not exists (select 1 from issues i where i.id = new.issue_id and i.client_id = new.client_id) then
    raise exception 'issue does not belong to this client' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger evidence_issue_client_trg before insert or update on evidence_items for each row execute function evidence_check_issue_client();

-- ---------------------------------------------------------------------------
-- Medical review and source records. A status here is a workflow state, never regulatory certification.
-- ---------------------------------------------------------------------------
create table medical_claims (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id),
  claim_summary text not null check (length(claim_summary) between 1 and 300),
  location text,
  status text not null default 'draft' check (status in ('draft', 'under_review', 'approved', 'rejected', 'withdrawn')),
  current_wording_id uuid,
  created_by uuid not null references staff_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  withdrawn_at timestamptz
);
create index medical_claims_client_idx on medical_claims (client_id, status);

create table claim_wordings (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references medical_claims (id),
  client_id uuid not null references clients (id),
  version integer not null check (version >= 1),
  wording text not null check (length(wording) between 1 and 4000),
  created_by uuid not null references staff_users (id),
  created_at timestamptz not null default now(),
  unique (claim_id, version)
);
create trigger claim_wordings_no_update before update on claim_wordings for each row execute function block_mutation();
create trigger claim_wordings_no_delete before delete on claim_wordings for each row execute function block_mutation();

create table medical_reviews (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references medical_claims (id),
  client_id uuid not null references clients (id),
  wording_id uuid not null references claim_wordings (id),
  reviewer_user_id uuid not null references staff_users (id),
  status text not null default 'assigned' check (status in ('assigned', 'in_progress', 'decided', 'superseded')),
  decision text check (decision in ('approved', 'rejected', 'changes_required')),
  decision_note text,
  assigned_by uuid not null references staff_users (id),
  assigned_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint medical_reviews_decision_pair check ((status = 'decided') = (decision is not null and decided_at is not null))
);
create index medical_reviews_claim_idx on medical_reviews (claim_id, assigned_at);

-- Once decided, a review only moves to superseded (when wording changes materially). Its decision never changes.
create or replace function medical_reviews_guard() returns trigger
language plpgsql as $$
begin
  if old.status = 'decided' then
    if new.status <> 'superseded' or new.decision <> old.decision or new.decision_note is distinct from old.decision_note
       or new.decided_at <> old.decided_at or new.wording_id <> old.wording_id or new.reviewer_user_id <> old.reviewer_user_id then
      raise exception 'decided medical reviews are immutable' using errcode = 'insufficient_privilege';
    end if;
  end if;
  if old.status = 'superseded' then
    raise exception 'superseded medical reviews are immutable' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
create trigger medical_reviews_guard_update before update on medical_reviews for each row execute function medical_reviews_guard();
create trigger medical_reviews_no_delete before delete on medical_reviews for each row execute function block_mutation();

create table medical_sources (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references medical_claims (id),
  client_id uuid not null references clients (id),
  review_id uuid references medical_reviews (id),
  title text not null check (length(title) between 1 and 300),
  citation text,
  url text check (url is null or url ~ '^https?://'),
  source_type text not null default 'other' check (source_type in ('guideline', 'peer_reviewed', 'regulator', 'manufacturer', 'clinic_record', 'other')),
  added_by uuid not null references staff_users (id),
  created_at timestamptz not null default now()
);
create index medical_sources_claim_idx on medical_sources (claim_id);

-- ---------------------------------------------------------------------------
-- Performance reporting: immutable snapshots. NULL value means unavailable, never zero.
-- ---------------------------------------------------------------------------
create table report_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id),
  source text not null check (source in ('manual', 'ga4_export', 'search_console_export', 'google_ads_export', 'clinic_records', 'other')),
  channel text not null check (channel in ('all', 'organic_search', 'paid_search', 'direct', 'referral', 'social', 'email', 'other')),
  metric text not null check (metric in ('impressions', 'clicks', 'sessions', 'enquiries', 'confirmed_appointments', 'patients', 'cost', 'conversions_reported')),
  period_start date not null,
  period_end date not null,
  value numeric(14, 2),
  unit text not null default 'count' check (unit in ('count', 'sgd')),
  note text,
  entered_by uuid not null references staff_users (id),
  created_at timestamptz not null default now(),
  supersedes_id uuid references report_snapshots (id),
  superseded_by_id uuid references report_snapshots (id),
  constraint report_snapshots_period check (period_end >= period_start)
);
create unique index report_snapshots_current_idx on report_snapshots (client_id, source, channel, metric, period_start, period_end) where superseded_by_id is null;
create index report_snapshots_client_period_idx on report_snapshots (client_id, period_start, period_end);

create or replace function report_snapshots_guard() returns trigger
language plpgsql as $$
begin
  if old.superseded_by_id is not null or new.superseded_by_id is null
     or new.value is distinct from old.value or new.note is distinct from old.note or new.metric <> old.metric
     or new.period_start <> old.period_start or new.period_end <> old.period_end or new.source <> old.source
     or new.channel <> old.channel or new.client_id <> old.client_id or new.entered_by <> old.entered_by then
    raise exception 'report_snapshots is append-only' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
create trigger report_snapshots_guard_update before update on report_snapshots for each row execute function report_snapshots_guard();
create trigger report_snapshots_no_delete before delete on report_snapshots for each row execute function block_mutation();

create table report_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id),
  period_start date not null,
  period_end date not null,
  observation text not null check (length(observation) between 1 and 4000),
  possible_explanations text,
  author_user_id uuid not null references staff_users (id),
  created_at timestamptz not null default now()
);
create index report_notes_client_idx on report_notes (client_id, period_start desc);

-- ---------------------------------------------------------------------------
-- Change and outcome timeline: generated by workflows, idempotent on retry, append-only
-- ---------------------------------------------------------------------------
create table timeline_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id),
  occurred_at timestamptz not null default now(),
  event_type text not null,
  title text not null check (length(title) between 1 and 300),
  summary text,
  related_type text,
  related_id uuid,
  actor_user_id uuid references staff_users (id),
  dedupe_key text not null unique,
  created_at timestamptz not null default now()
);
create index timeline_events_client_idx on timeline_events (client_id, occurred_at desc);
create trigger timeline_events_no_update before update on timeline_events for each row execute function block_mutation();
create trigger timeline_events_no_delete before delete on timeline_events for each row execute function block_mutation();

-- ---------------------------------------------------------------------------
-- Row-level security for module tables
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['tasks','task_history','task_notes','approvals','seo_pages','seo_changes','ads_audits','ads_findings','ads_changes',
                           'issues','issue_history','evidence_items','medical_claims','claim_wordings','report_snapshots','report_notes'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I_select on %I for select using (app_can_access_client(client_id))', t, t);
    execute format('create policy %I_edit on %I for all using (app_can_edit_client(client_id)) with check (app_can_edit_client(client_id))', t, t);
  end loop;
end $$;

-- Reviewers may record approval decisions, medical reviews and sources for their clients.
alter table approval_decisions enable row level security;
create policy approval_decisions_select on approval_decisions for select using (app_can_access_client(client_id));
create policy approval_decisions_write on approval_decisions for all
  using (app_can_review_client(client_id)) with check (app_can_review_client(client_id));

alter table medical_reviews enable row level security;
create policy medical_reviews_select on medical_reviews for select using (app_can_access_client(client_id));
create policy medical_reviews_write on medical_reviews for all
  using (app_can_review_client(client_id) or app_can_edit_client(client_id))
  with check (app_can_review_client(client_id) or app_can_edit_client(client_id));

alter table medical_sources enable row level security;
create policy medical_sources_select on medical_sources for select using (app_can_access_client(client_id));
create policy medical_sources_write on medical_sources for all
  using (app_can_review_client(client_id) or app_can_edit_client(client_id))
  with check (app_can_review_client(client_id) or app_can_edit_client(client_id));

-- Reviewers also update approvals' current decision pointer; allow update for reviewers on approvals.
create policy approvals_review_update on approvals for update
  using (app_can_review_client(client_id)) with check (app_can_review_client(client_id));

alter table timeline_events enable row level security;
create policy timeline_events_select on timeline_events for select using (app_can_access_client(client_id));
create policy timeline_events_insert on timeline_events for insert
  with check (app_can_edit_client(client_id) or app_can_review_client(client_id));
