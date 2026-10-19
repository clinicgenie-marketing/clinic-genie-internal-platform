import { closePools, getAdminPool } from "../src/client";
import { loadRootEnv } from "../src/env";
import { ensureAppRole, runMigrations } from "../src/migrate";

loadRootEnv();
const pool = getAdminPool();
try {
  await ensureAppRole(pool, process.env.APP_DB_PASSWORD || "cg_app_dev");
  const result = await runMigrations(pool, (l) => console.log(l));
  console.log(`Migrations: ${result.applied.length} applied, ${result.skipped.length} already applied.`);
} finally {
  await closePools();
}
