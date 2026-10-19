import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type pg from "pg";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

/** Creates or updates the application role. Needs the owner connection. */
export async function ensureAppRole(pool: pg.Pool, password: string): Promise<void> {
  const { rows } = await pool.query("select 1 from pg_roles where rolname = 'cg_app'");
  const escaped = password.replace(/'/g, "''");
  if (rows.length === 0) {
    await pool.query(`create role cg_app login nobypassrls password '${escaped}'`);
  } else {
    await pool.query(`alter role cg_app with login nobypassrls password '${escaped}'`);
  }
}

export async function runMigrations(pool: pg.Pool, log: (line: string) => void = () => {}): Promise<MigrationResult> {
  await pool.query(`create table if not exists schema_migrations (
    name text primary key,
    checksum text not null,
    applied_at timestamptz not null default now()
  )`);
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const { rows } = await pool.query<{ name: string; checksum: string }>("select name, checksum from schema_migrations");
  const done = new Map(rows.map((r) => [r.name, r.checksum]));
  const result: MigrationResult = { applied: [], skipped: [] };
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const existing = done.get(file);
    if (existing) {
      if (existing !== checksum) {
        throw new Error(`Migration ${file} was modified after it was applied. Add a new migration instead.`);
      }
      result.skipped.push(file);
      continue;
    }
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into schema_migrations (name, checksum) values ($1, $2)", [file, checksum]);
      await client.query("commit");
      result.applied.push(file);
      log(`applied ${file}`);
    } catch (err) {
      await client.query("rollback");
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }
  return result;
}

export function databaseNameFromUrl(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  } catch {
    return "";
  }
}

/** Refuses to run destructive helpers against anything that does not look like a development or test database. */
export function assertSafeTarget(url: string): void {
  const pattern = process.env.SEED_ALLOWED_DB_PATTERN || "clinic_genie";
  const name = databaseNameFromUrl(url);
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run in NODE_ENV=production.");
  }
  if (!name.includes(pattern)) {
    throw new Error(`Refusing to touch database "${name}": name does not contain "${pattern}".`);
  }
}
