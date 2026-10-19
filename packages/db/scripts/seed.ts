import { closePools, getAdminPool } from "../src/client";
import { loadRootEnv, requireEnv } from "../src/env";
import { assertSafeTarget } from "../src/migrate";
import { seedDemo } from "../src/seed";

loadRootEnv();
assertSafeTarget(requireEnv("DATABASE_ADMIN_URL"));
try {
  await seedDemo(getAdminPool(), (l) => console.log(l));
} finally {
  await closePools();
}
