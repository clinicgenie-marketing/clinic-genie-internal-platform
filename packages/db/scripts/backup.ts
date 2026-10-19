import { join, resolve } from "node:path";
import { writeBackup } from "../src/backup";
import { closePools, getAdminPool } from "../src/client";
import { loadRootEnv } from "../src/env";

loadRootEnv();
const outDir = resolve(process.argv[2] ?? join(process.cwd().includes("packages/db") ? "../../backups" : "backups"));
try {
  const result = await writeBackup(getAdminPool(), outDir);
  console.log(`Backup written: ${result.file}`);
  console.log(JSON.stringify(result.counts));
} finally {
  await closePools();
}
