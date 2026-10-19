import type { Queryable } from "../client";

/** Development only: records sign-in links instead of sending email. Guarded by AUTH_DEV_MAGIC_LINKS. */
export async function recordMagicLink(db: Queryable, email: string, url: string, expires: Date): Promise<void> {
  await db.query("insert into dev_magic_links (email, url, expires_at) values ($1, $2, $3)", [email.toLowerCase(), url, expires]);
  await db.query("delete from dev_magic_links where expires_at < now()");
}

export async function listMagicLinks(db: Queryable): Promise<Array<{ id: string; email: string; url: string; created_at: Date; expires_at: Date }>> {
  const { rows } = await db.query("select * from dev_magic_links where expires_at > now() order by created_at desc limit 20");
  return rows;
}
