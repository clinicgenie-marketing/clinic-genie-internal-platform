import type { ClientChannel, PlatformRole } from "@clinic-genie/contracts";
import type { Queryable } from "../client";
import { recordAudit } from "./audit";
import { recordTimeline } from "./timeline";

export interface ClientRow {
  id: string;
  slug: string;
  name: string;
  status: "active" | "archived";
  owner_user_id: string | null;
  owner_name: string | null;
  channels: ClientChannel[];
  is_synthetic: boolean;
  notes: string | null;
  created_at: Date;
  archived_at: Date | null;
}

export interface WebsiteRow {
  id: string;
  client_id: string;
  name: string;
  url: string | null;
  platform: string;
  environment: "production" | "staging" | "development";
  status: "active" | "archived";
  notes: string | null;
  created_at: Date;
  archived_at: Date | null;
}

export interface AccountReferenceRow {
  id: string;
  client_id: string;
  kind: string;
  label: string;
  external_identifier: string | null;
  url: string | null;
  vault_reference: string | null;
  notes: string | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface MembershipRow {
  id: string;
  user_id: string;
  client_id: string;
  active: boolean;
  user_email: string;
  user_name: string;
  user_role: PlatformRole;
  created_at: Date;
}

export interface StaffRow {
  id: string;
  email: string;
  display_name: string;
  platform_role: PlatformRole;
  active: boolean;
  membership_count: number;
}

const CLIENT_SELECT = `select c.*, u.display_name as owner_name from clients c left join staff_users u on u.id = c.owner_user_id`;

export async function listClients(db: Queryable, opts: { includeArchived?: boolean } = {}): Promise<ClientRow[]> {
  const { rows } = await db.query<ClientRow>(`${CLIENT_SELECT} where ($1 or c.status = 'active') order by c.status, c.name`, [opts.includeArchived ?? false]);
  return rows;
}

export async function getClient(db: Queryable, id: string): Promise<ClientRow | null> {
  const { rows } = await db.query<ClientRow>(`${CLIENT_SELECT} where c.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function getClientBySlug(db: Queryable, slug: string): Promise<ClientRow | null> {
  const { rows } = await db.query<ClientRow>(`${CLIENT_SELECT} where c.slug = $1`, [slug]);
  return rows[0] ?? null;
}

export interface ClientInput {
  slug: string;
  name: string;
  ownerUserId: string | null;
  channels: ClientChannel[];
  isSynthetic: boolean;
  notes: string | null;
}

export async function createClient(db: Queryable, input: ClientInput, actorUserId: string): Promise<ClientRow> {
  const { rows } = await db.query<{ id: string }>(
    "insert into clients (slug, name, owner_user_id, channels, is_synthetic, notes) values ($1, $2, $3, $4, $5, $6) returning id",
    [input.slug, input.name, input.ownerUserId, input.channels, input.isSynthetic, input.notes],
  );
  const id = rows[0]!.id;
  await recordAudit(db, { actorType: "staff", actorUserId, action: "client.create", targetType: "client", targetId: id, clientId: id, outcome: "success", metadata: { slug: input.slug } });
  await recordTimeline(db, { clientId: id, eventType: "client_created", title: `Client ${input.name} created`, relatedType: null, relatedId: null, actorUserId, dedupeKey: `client_created:${id}` });
  return (await getClient(db, id))!;
}

export async function updateClient(db: Queryable, id: string, input: Omit<ClientInput, "slug" | "isSynthetic">, actorUserId: string): Promise<void> {
  await db.query("update clients set name = $2, owner_user_id = $3, channels = $4, notes = $5 where id = $1", [id, input.name, input.ownerUserId, input.channels, input.notes]);
  await recordAudit(db, { actorType: "staff", actorUserId, action: "client.update", targetType: "client", targetId: id, clientId: id, outcome: "success", metadata: { fields: ["name", "owner", "channels", "notes"] } });
}

/** Soft archive. Every linked record is retained. */
export async function archiveClient(db: Queryable, id: string, actorUserId: string): Promise<void> {
  const { rowCount } = await db.query("update clients set status = 'archived', archived_at = now() where id = $1 and status = 'active'", [id]);
  if (!rowCount) return;
  await recordAudit(db, { actorType: "staff", actorUserId, action: "client.archive", targetType: "client", targetId: id, clientId: id, outcome: "success" });
  await recordTimeline(db, { clientId: id, eventType: "client_archived", title: "Client archived", relatedType: null, relatedId: null, actorUserId, dedupeKey: `client_archived:${id}:${Date.now()}` });
}

export async function restoreClient(db: Queryable, id: string, actorUserId: string): Promise<void> {
  await db.query("update clients set status = 'active', archived_at = null where id = $1", [id]);
  await recordAudit(db, { actorType: "staff", actorUserId, action: "client.restore", targetType: "client", targetId: id, clientId: id, outcome: "success" });
}

// --- Websites ---------------------------------------------------------------

export async function listWebsites(db: Queryable, clientId: string): Promise<WebsiteRow[]> {
  const { rows } = await db.query<WebsiteRow>("select * from websites where client_id = $1 order by status, created_at", [clientId]);
  return rows;
}

export async function createWebsite(
  db: Queryable,
  input: { clientId: string; name: string; url: string | null; platform: string; environment: WebsiteRow["environment"]; notes: string | null },
  actorUserId: string,
): Promise<WebsiteRow> {
  const { rows } = await db.query<WebsiteRow>(
    "insert into websites (client_id, name, url, platform, environment, notes) values ($1, $2, $3, $4, $5, $6) returning *",
    [input.clientId, input.name, input.url, input.platform, input.environment, input.notes],
  );
  await recordAudit(db, { actorType: "staff", actorUserId, action: "website.create", targetType: "website", targetId: rows[0]!.id, clientId: input.clientId, outcome: "success", metadata: { environment: input.environment } });
  return rows[0]!;
}

export async function updateWebsite(
  db: Queryable,
  id: string,
  input: { name: string; url: string | null; platform: string; environment: WebsiteRow["environment"]; status: WebsiteRow["status"]; notes: string | null },
  actorUserId: string,
): Promise<void> {
  const { rows } = await db.query<WebsiteRow>(
    `update websites set name = $2, url = $3, platform = $4, environment = $5, status = $6, notes = $7,
       archived_at = case when $6 = 'archived' and archived_at is null then now() when $6 = 'active' then null else archived_at end
     where id = $1 returning *`,
    [id, input.name, input.url, input.platform, input.environment, input.status, input.notes],
  );
  const site = rows[0];
  if (!site) return;
  await recordAudit(db, { actorType: "staff", actorUserId, action: "website.update", targetType: "website", targetId: id, clientId: site.client_id, outcome: "success", metadata: { status: input.status } });
}

// --- Account references -----------------------------------------------------

export async function listAccountReferences(db: Queryable, clientId: string, includeInactive = false): Promise<AccountReferenceRow[]> {
  const { rows } = await db.query<AccountReferenceRow>("select * from account_references where client_id = $1 and ($2 or active) order by kind, label", [clientId, includeInactive]);
  return rows;
}

export interface AccountReferenceInput {
  kind: string;
  label: string;
  externalIdentifier: string | null;
  url: string | null;
  vaultReference: string | null;
  notes: string | null;
}

const SECRET_LIKE = /(password|passwd|secret|api[-_ ]?key|token)\s*[:=]/i;

export class RegistryRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistryRuleError";
  }
}

/** Rejects values that look like credentials. References point to a vault entry; they never hold the secret. */
export function assertNoSecret(input: AccountReferenceInput): void {
  for (const v of [input.externalIdentifier, input.vaultReference, input.notes, input.label]) {
    if (v && SECRET_LIKE.test(v)) throw new RegistryRuleError("This looks like a credential. Store the secret in the password vault and save only its reference here.");
  }
}

export async function createAccountReference(db: Queryable, clientId: string, input: AccountReferenceInput, actorUserId: string): Promise<AccountReferenceRow> {
  assertNoSecret(input);
  const { rows } = await db.query<AccountReferenceRow>(
    "insert into account_references (client_id, kind, label, external_identifier, url, vault_reference, notes) values ($1, $2, $3, $4, $5, $6, $7) returning *",
    [clientId, input.kind, input.label, input.externalIdentifier, input.url, input.vaultReference, input.notes],
  );
  await recordAudit(db, { actorType: "staff", actorUserId, action: "account_reference.create", targetType: "account_reference", targetId: rows[0]!.id, clientId, outcome: "success", metadata: { kind: input.kind } });
  return rows[0]!;
}

export async function updateAccountReference(db: Queryable, id: string, input: AccountReferenceInput & { active: boolean }, actorUserId: string): Promise<void> {
  assertNoSecret(input);
  const { rows } = await db.query<AccountReferenceRow>(
    "update account_references set kind = $2, label = $3, external_identifier = $4, url = $5, vault_reference = $6, notes = $7, active = $8, updated_at = now() where id = $1 returning *",
    [id, input.kind, input.label, input.externalIdentifier, input.url, input.vaultReference, input.notes, input.active],
  );
  const ref = rows[0];
  if (!ref) return;
  await recordAudit(db, { actorType: "staff", actorUserId, action: "account_reference.update", targetType: "account_reference", targetId: id, clientId: ref.client_id, outcome: "success", metadata: { kind: input.kind, active: input.active } });
}

// --- Staff and memberships --------------------------------------------------

export async function listStaff(db: Queryable): Promise<StaffRow[]> {
  const { rows } = await db.query<StaffRow>(
    `select u.id, u.email, u.display_name, u.platform_role, u.active,
            (select count(*)::int from memberships m where m.user_id = u.id and m.active) as membership_count
     from staff_users u order by u.active desc, u.display_name`,
  );
  return rows;
}

export async function listActiveStaff(db: Queryable): Promise<Array<{ id: string; display_name: string; platform_role: PlatformRole }>> {
  const { rows } = await db.query("select id, display_name, platform_role from staff_users where active order by display_name");
  return rows;
}

export async function createStaff(db: Queryable, input: { email: string; displayName: string; role: PlatformRole }, actorUserId: string | null): Promise<string> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  const { rows } = await db.query<{ id: string }>("insert into staff_users (email, display_name, platform_role) values ($1, $2, $3) returning id", [email, input.displayName.trim(), input.role]);
  await recordAudit(db, { actorType: actorUserId ? "staff" : "system", actorUserId, action: "staff.create", targetType: "staff_user", targetId: rows[0]!.id, outcome: "success", metadata: { role: input.role } });
  return rows[0]!.id;
}

export async function updateStaff(db: Queryable, userId: string, input: { displayName: string; role: PlatformRole; active: boolean }, actorUserId: string): Promise<void> {
  const before = (await db.query<{ platform_role: string; active: boolean }>("select platform_role, active from staff_users where id = $1", [userId])).rows[0];
  await db.query(
    "update staff_users set display_name = $2, platform_role = $3, active = $4, deactivated_at = case when $4 then null else coalesce(deactivated_at, now()) end where id = $1",
    [userId, input.displayName.trim(), input.role, input.active],
  );
  if (!input.active) {
    // Revoke live sessions promptly so a deactivated user cannot keep working.
    await db.query(`delete from sessions where "userId" in (select id from users where lower(email) = (select email from staff_users where id = $1))`, [userId]);
  }
  await recordAudit(db, {
    actorType: "staff",
    actorUserId,
    action: "staff.update",
    targetType: "staff_user",
    targetId: userId,
    outcome: "success",
    metadata: { roleFrom: before?.platform_role, roleTo: input.role, activeFrom: before?.active, activeTo: input.active },
  });
}

export async function listMemberships(db: Queryable, clientId: string): Promise<MembershipRow[]> {
  const { rows } = await db.query<MembershipRow>(
    `select m.id, m.user_id, m.client_id, m.active, m.created_at, u.email as user_email, u.display_name as user_name, u.platform_role as user_role
     from memberships m join staff_users u on u.id = m.user_id where m.client_id = $1 and m.active order by u.display_name`,
    [clientId],
  );
  return rows;
}

export async function listMembershipsForUser(db: Queryable, userId: string): Promise<Array<{ id: string; client_id: string; client_name: string }>> {
  const { rows } = await db.query("select m.id, m.client_id, c.name as client_name from memberships m join clients c on c.id = m.client_id where m.user_id = $1 and m.active order by c.name", [userId]);
  return rows;
}

export async function grantMembership(db: Queryable, input: { userId: string; clientId: string }, actorUserId: string | null): Promise<string> {
  const existing = await db.query<{ id: string }>("select id from memberships where user_id = $1 and client_id = $2 and active", [input.userId, input.clientId]);
  if (existing.rows[0]) return existing.rows[0].id;
  const { rows } = await db.query<{ id: string }>("insert into memberships (user_id, client_id, granted_by) values ($1, $2, $3) returning id", [input.userId, input.clientId, actorUserId]);
  await recordAudit(db, { actorType: actorUserId ? "staff" : "system", actorUserId, action: "membership.grant", targetType: "membership", targetId: rows[0]!.id, clientId: input.clientId, outcome: "success", metadata: { userId: input.userId } });
  return rows[0]!.id;
}

export async function revokeMembership(db: Queryable, membershipId: string, actorUserId: string): Promise<void> {
  const { rows } = await db.query<{ client_id: string; user_id: string }>("update memberships set active = false, revoked_at = now() where id = $1 and active returning client_id, user_id", [membershipId]);
  const m = rows[0];
  if (!m) return;
  await recordAudit(db, { actorType: "staff", actorUserId, action: "membership.revoke", targetType: "membership", targetId: membershipId, clientId: m.client_id, outcome: "success", metadata: { userId: m.user_id } });
}
