-- 0001 Foundation: staff, roles, clients, memberships, websites, account references, audit, operational records, auth tables.
-- Compatible with managed PostgreSQL (including Supabase). Row-level security applies to the application role cg_app.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Context helpers. The application sets these per transaction with set_config(..., true).
-- app.context        'staff' | 'service' | 'public'
-- app.user_id        uuid of the authenticated staff user
-- app.platform_role  admin | manager | specialist | reviewer | read_only (looked up server-side, never from the client)
-- ---------------------------------------------------------------------------
create or replace function app_current_user_id() returns uuid
language sql stable as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

create or replace function app_platform_role() returns text
language sql stable as $$ select coalesce(nullif(current_setting('app.platform_role', true), ''), 'none') $$;

create or replace function app_context() returns text
language sql stable as $$ select coalesce(nullif(current_setting('app.context', true), ''), 'public') $$;

create or replace function app_is_service() returns boolean
language sql stable as $$ select app_context() = 'service' $$;

create or replace function app_is_admin() returns boolean
language sql stable as $$ select app_is_service() or app_platform_role() = 'admin' $$;

create or replace function app_is_global() returns boolean
language sql stable as $$ select app_is_service() or app_platform_role() in ('admin', 'manager') $$;

-- ---------------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------------
create table staff_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  display_name text not null,
  platform_role text not null default 'read_only' check (platform_role in ('admin', 'manager', 'specialist', 'reviewer', 'read_only')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  deactivated_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Clients: the top-level tenant
-- ---------------------------------------------------------------------------
create table clients (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  owner_user_id uuid references staff_users (id),
  channels text[] not null default '{}',
  is_synthetic boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index clients_status_idx on clients (status);

-- Memberships grant client scope. The role lives on the staff record.
create table memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references staff_users (id),
  client_id uuid not null references clients (id),
  active boolean not null default true,
  granted_by uuid references staff_users (id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index memberships_one_active_idx on memberships (user_id, client_id) where active;
create index memberships_client_idx on memberships (client_id) where active;

create or replace function app_has_membership(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m join staff_users u on u.id = m.user_id
    where m.client_id = cid and m.user_id = app_current_user_id() and m.active and u.active
  )
$$;

-- Read access: global roles see every client; scoped roles need a membership.
create or replace function app_can_access_client(cid uuid) returns boolean
language sql stable as $$ select app_is_global() or app_has_membership(cid) $$;

-- Edit access (tasks, SEO, Ads, issues, claims, reports): admin, manager, or specialist with membership.
create or replace function app_can_edit_client(cid uuid) returns boolean
language sql stable as $$
  select app_is_global() or (app_platform_role() = 'specialist' and app_has_membership(cid))
$$;

-- Review access (medical reviews, approval decisions): admin, manager, or reviewer with membership.
create or replace function app_can_review_client(cid uuid) returns boolean
language sql stable as $$
  select app_is_global() or (app_platform_role() = 'reviewer' and app_has_membership(cid))
$$;

-- ---------------------------------------------------------------------------
-- Linked websites and account references
-- ---------------------------------------------------------------------------
create table websites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id),
  name text not null,
  url text check (url is null or url ~ '^https?://'),
  platform text not null default 'unknown',
  environment text not null default 'production' check (environment in ('production', 'staging', 'development')),
  status text not null default 'active' check (status in ('active', 'archived')),
  notes text,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index websites_client_idx on websites (client_id);

-- A reference is a saved link and identifier, never a connected integration and never a credential.
create table account_references (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id),
  kind text not null check (kind in ('ga4', 'search_console', 'google_ads', 'tag_manager', 'google_business', 'wix', 'hosting', 'domain', 'booking', 'other')),
  label text not null,
  external_identifier text,
  url text check (url is null or url ~ '^https?://'),
  vault_reference text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index account_references_client_idx on account_references (client_id) where active;

-- ---------------------------------------------------------------------------
-- Security audit log: append-only
-- ---------------------------------------------------------------------------
create table audit_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_type text not null check (actor_type in ('staff', 'service', 'public', 'system')),
  actor_user_id uuid references staff_users (id),
  action text not null,
  target_type text not null,
  target_id text,
  client_id uuid references clients (id),
  outcome text not null check (outcome in ('success', 'denied', 'failure')),
  metadata jsonb not null default '{}'::jsonb
);
create index audit_events_client_idx on audit_events (client_id, occurred_at desc);
create index audit_events_occurred_idx on audit_events (occurred_at desc);

create or replace function block_mutation() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = 'insufficient_privilege';
end $$;

create trigger audit_events_no_update before update on audit_events for each row execute function block_mutation();
create trigger audit_events_no_delete before delete on audit_events for each row execute function block_mutation();

-- ---------------------------------------------------------------------------
-- Operational records
-- ---------------------------------------------------------------------------
create table backup_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('backup', 'restore_test')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  outcome text not null default 'running' check (outcome in ('running', 'passed', 'failed')),
  target text not null,
  artefact_ref text,
  record_counts jsonb not null default '{}'::jsonb,
  notes text
);

-- Development-only magic links. Recorded instead of sending mail.
create table dev_magic_links (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  url text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- ---------------------------------------------------------------------------
-- Auth.js tables (identity). Authorisation stays in staff_users and memberships.
-- ---------------------------------------------------------------------------
create table verification_token (
  identifier text not null,
  expires timestamptz not null,
  token text not null,
  primary key (identifier, token)
);
create table users (
  id serial primary key,
  name varchar(255),
  email varchar(255),
  "emailVerified" timestamptz,
  image text
);
create table accounts (
  id serial primary key,
  "userId" integer not null references users (id) on delete cascade,
  type varchar(255) not null,
  provider varchar(255) not null,
  "providerAccountId" varchar(255) not null,
  refresh_token text,
  access_token text,
  expires_at bigint,
  id_token text,
  scope text,
  session_state text,
  token_type text
);
create table sessions (
  id serial primary key,
  "userId" integer not null references users (id) on delete cascade,
  expires timestamptz not null,
  "sessionToken" varchar(255) not null unique
);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table staff_users enable row level security;
alter table clients enable row level security;
alter table memberships enable row level security;
alter table websites enable row level security;
alter table account_references enable row level security;
alter table audit_events enable row level security;
alter table backup_runs enable row level security;

create policy staff_users_select on staff_users for select using (app_is_service() or app_current_user_id() is not null);
create policy staff_users_admin_write on staff_users for all using (app_is_admin()) with check (app_is_admin());

create policy clients_select on clients for select using (app_can_access_client(id));
create policy clients_global_write on clients for all using (app_is_global()) with check (app_is_global());

create policy memberships_select on memberships for select using (app_is_global() or user_id = app_current_user_id());
create policy memberships_admin_write on memberships for all using (app_is_admin()) with check (app_is_admin());

create policy websites_select on websites for select using (app_can_access_client(client_id));
create policy websites_write on websites for all using (app_can_edit_client(client_id)) with check (app_can_edit_client(client_id));

create policy account_references_select on account_references for select using (app_can_access_client(client_id));
create policy account_references_write on account_references for all using (app_can_edit_client(client_id)) with check (app_can_edit_client(client_id));

create policy audit_events_insert on audit_events for insert with check (true);
create policy audit_events_select on audit_events for select
  using (app_is_admin() or (client_id is not null and app_can_access_client(client_id)));

create policy backup_runs_select on backup_runs for select using (app_is_admin());
create policy backup_runs_service_write on backup_runs for all using (app_is_service()) with check (app_is_service());
