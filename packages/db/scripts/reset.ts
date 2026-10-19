/** Drops and recreates the public schema, then re-applies migrations. Development only. */
import { closePools, getAdminPool } from "../src/client";
import { loadRootEnv, requireEnv } from "../src/env";
import { assertSafeTarget, ensureAppRole, runMigrations } from "../src/migrate";

loadRootEnv();
assertSafeTarget(requireEnv("DATABASE_ADMIN_URL"));
const pool = getAdminPool();
try {
  await pool.query("drop schema public cascade; create schema public;");
  await ensureAppRole(pool, process.env.APP_DB_PASSWORD || "cg_app_dev");
  const result = await runMigrations(pool, (l) => console.log(l));
  console.log(`Schema reset. ${result.applied.length} migrations applied.`);
} finally {
  await closePools();
}
