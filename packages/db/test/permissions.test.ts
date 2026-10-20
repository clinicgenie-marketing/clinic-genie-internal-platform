import { afterAll, describe, expect, it } from "vitest";
import { adminPool, appPool, asContext, clientBySlug, staffByEmail, staffCtx } from "./helpers";
import { listClients } from "../src/services/registry";
import { listTasks, createTask } from "../src/services/tasks";
import { listApprovals } from "../src/services/approvals";
import { listIssues } from "../src/services/issues";
import { listClaims } from "../src/services/medical";

afterAll(async () => {
  await adminPool.end();
  await appPool.end();
});

describe("client isolation through row-level security (A-04, A-05, A-06)", () => {
  it("a specialist sees only clients they are a member of", async () => {
    const specB = await staffByEmail("specialist-b@example.invalid");
    const clients = await asContext(staffCtx(specB), (db) => listClients(db));
    expect(clients.map((c) => c.slug)).toEqual(["northgate-physio"]);
  });

  it("direct queries for another client's tasks, approvals, issues and claims return nothing", async () => {
    const specB = await staffByEmail("specialist-b@example.invalid");
    const harbour = await clientBySlug("harbourview-dental");
    const meridian = await clientBySlug("meridian-skin");
    const result = await asContext(staffCtx(specB), async (db) => ({
      tasks: await listTasks(db, { clientId: harbour }),
      approvals: await listApprovals(db, { clientId: harbour }),
      issues: await listIssues(db, { clientId: meridian }),
      claims: await listClaims(db, { clientId: meridian }),
      rawTasks: (await db.query("select count(*)::int as n from tasks where client_id = $1", [harbour])).rows[0].n,
      rawSnapshots: (await db.query("select count(*)::int as n from report_snapshots where client_id = $1", [harbour])).rows[0].n,
    }));
    expect(result.tasks).toHaveLength(0);
    expect(result.approvals).toHaveLength(0);
    expect(result.issues).toHaveLength(0);
    expect(result.claims).toHaveLength(0);
    expect(result.rawTasks).toBe(0);
    expect(result.rawSnapshots).toBe(0);
  });

  it("guessing a record id outside the membership behaves as not found", async () => {
    const specB = await staffByEmail("specialist-b@example.invalid");
    const { rows } = await adminPool.query("select t.id from tasks t join clients c on c.id = t.client_id where c.slug = 'harbourview-dental' limit 1");
    const found = await asContext(staffCtx(specB), async (db) => (await db.query("select id from tasks where id = $1", [rows[0].id])).rows.length);
    expect(found).toBe(0);
  });

  it("a specialist cannot insert a task for a client they do not belong to, even with a valid id", async () => {
    const specB = await staffByEmail("specialist-b@example.invalid");
    const harbour = await clientBySlug("harbourview-dental");
    await expect(
      asContext(staffCtx(specB), (db) => createTask(db, { clientId: harbour, title: "Cross-client write", description: null, ownerUserId: specB.id, priority: "low", dueDate: null, relatedType: null, relatedId: null }, specB.id)),
    ).rejects.toThrow();
  });

  it("read-only users cannot mutate records through direct statements", async () => {
    const ro = await staffByEmail("readonly@example.invalid");
    const harbour = await clientBySlug("harbourview-dental");
    const visible = await asContext(staffCtx(ro), (db) => listTasks(db, { clientId: harbour }));
    expect(visible.length).toBeGreaterThan(0);
    await expect(asContext(staffCtx(ro), (db) => db.query("update tasks set title = 'tampered' where id = $1", [visible[0]!.id]).then((r) => { if ((r.rowCount ?? 0) === 0) throw new Error("no rows updated"); }))).rejects.toThrow();
    await expect(asContext(staffCtx(ro), (db) => db.query("insert into task_notes (task_id, client_id, author_user_id, body) values ($1, $2, $3, 'x')", [visible[0]!.id, harbour, ro.id]))).rejects.toThrow();
  });

  it("a reviewer can read their client's records but cannot edit tasks", async () => {
    const reviewer = await staffByEmail("reviewer@example.invalid");
    const meridian = await clientBySlug("meridian-skin");
    const tasks = await asContext(staffCtx(reviewer), (db) => listTasks(db, { clientId: meridian }));
    expect(tasks.length).toBeGreaterThan(0);
    const updated = await asContext(staffCtx(reviewer), async (db) => (await db.query("update tasks set title = 'tampered' where id = $1", [tasks[0]!.id])).rowCount);
    expect(updated).toBe(0);
  });

  it("two specialists see only their own client websites", async () => {
    const specA = await staffByEmail("specialist-a@example.invalid");
    const specB = await staffByEmail("specialist-b@example.invalid");
    const sites = async (user: Awaited<ReturnType<typeof staffByEmail>>) =>
      asContext(staffCtx(user), async (db) => (await db.query<{ slug: string }>("select c.slug from websites w join clients c on c.id = w.client_id order by c.slug")).rows.map((r) => r.slug));
    expect(await sites(specA)).toEqual(["harbourview-dental", "meridian-skin", "meridian-skin"]);
    expect(await sites(specB)).toEqual(["northgate-physio"]);
  });

  it("a specialist cannot add a website, even for a client they belong to", async () => {
    const specB = await staffByEmail("specialist-b@example.invalid");
    const northgate = await clientBySlug("northgate-physio");
    await expect(
      asContext(staffCtx(specB), (db) => db.query("insert into websites (client_id, name, platform) values ($1, 'Cross-role site', 'unknown')", [northgate])),
    ).rejects.toThrow(/row-level security/);
  });

  it("staff and anonymous contexts cannot read sign-in sessions", async () => {
    const specA = await staffByEmail("specialist-a@example.invalid");
    const staff = await asContext(staffCtx(specA), async (db) => (await db.query("select count(*)::int as n from sessions")).rows[0].n);
    const anon = await asContext({ kind: "public" }, async (db) => (await db.query("select count(*)::int as n from sessions")).rows[0].n);
    const links = await asContext(staffCtx(specA), async (db) => (await db.query("select count(*)::int as n from dev_magic_links")).rows[0].n);
    expect(staff).toBe(0);
    expect(anon).toBe(0);
    expect(links).toBe(0);
  });

  it("an anonymous (public) context sees no client data at all", async () => {
    const counts = await asContext({ kind: "public" }, async (db) => ({
      clients: (await db.query("select count(*)::int as n from clients")).rows[0].n,
      tasks: (await db.query("select count(*)::int as n from tasks")).rows[0].n,
      audit: (await db.query("select count(*)::int as n from audit_events")).rows[0].n,
    }));
    expect(counts).toEqual({ clients: 0, tasks: 0, audit: 0 });
  });

  it("a deactivated member loses access immediately", async () => {
    const specA = await staffByEmail("specialist-a@example.invalid");
    const harbour = await clientBySlug("harbourview-dental");
    const before = await asContext(staffCtx(specA), (db) => listTasks(db, { clientId: harbour }));
    expect(before.length).toBeGreaterThan(0);
    await adminPool.query("update staff_users set active = false where id = $1", [specA.id]);
    try {
      const after = await asContext(staffCtx(specA), (db) => listTasks(db, { clientId: harbour }));
      expect(after).toHaveLength(0);
    } finally {
      await adminPool.query("update staff_users set active = true where id = $1", [specA.id]);
    }
  });
});

describe("audit log protection (A-21)", () => {
  it("audit events cannot be updated or deleted, even by the owner", async () => {
    const { rows } = await adminPool.query("select id from audit_events limit 1");
    await expect(adminPool.query("update audit_events set outcome = 'denied' where id = $1", [rows[0].id])).rejects.toThrow(/append-only/);
    await expect(adminPool.query("delete from audit_events where id = $1", [rows[0].id])).rejects.toThrow(/append-only/);
  });
});
