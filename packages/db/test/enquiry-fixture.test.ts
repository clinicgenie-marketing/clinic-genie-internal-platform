import { afterAll, describe, expect, it } from "vitest";
import pg from "pg";
import { loadRootEnv, requireEnv } from "../src/env";
import { enquiryFixtureUrlFromAdmin } from "../src/testing/targets";
import {
  HARBOUR_DUPLICATE_KEY,
  RETRY_FAILURE_OUTBOX_ID,
  RETRY_SUCCESS_OUTBOX_ID,
  checkEnquiryFixture,
  ensureEnquiryDatabase,
  requeueNotification,
  resetEnquiryFixture,
} from "../src/testing/enquiry-fixture";

loadRootEnv();
delete process.env.ENQUIRY_DATABASE_URL;
const fixtureUrl = enquiryFixtureUrlFromAdmin(requireEnv("DATABASE_ADMIN_URL"));

describe("synthetic enquiry fixture", () => {
  afterAll(async () => {
    await resetEnquiryFixture(fixtureUrl);
  });

  it("resets labelled records and keeps a retry from creating another enquiry", async () => {
    await ensureEnquiryDatabase(requireEnv("DATABASE_ADMIN_URL"));
    const summary = await resetEnquiryFixture(fixtureUrl);
    expect(summary.database).toBe("clinic_genie_enquiry_test");
    expect(summary.host).toBe("127.0.0.1");
    expect(summary.clinics).toEqual(["harbourview-dental", "meridian-skin", "northgate-physio"]);
    expect(summary.enquiries).toBe(6);
    expect(summary.notifications).toBe(6);
    expect(summary.mailSink).toBe("notification_outbox");

    const url = fixtureUrl;
    const pool = new pg.Pool({ connectionString: url, max: 1 });
    try {
      const statuses = await pool.query<{ status: string; count: number }>(
        "select status, count(*)::int as count from enquiries group by status order by status",
      );
      expect(Object.fromEntries(statuses.rows.map((row) => [row.status, row.count]))).toEqual({ acknowledged: 2, closed: 1, new: 3 });
      const websites = await pool.query<{ website_key: string }>("select distinct website_key from enquiries order by website_key");
      expect(websites.rows.map((row) => row.website_key)).toEqual([
        "harbourview-dental-wix",
        "meridian-skin-production",
        "meridian-skin-staging",
        "northgate-physio-wix",
      ]);
      const sources = await pool.query<{ attribution_source: string }>("select distinct attribution_source from enquiries order by 1");
      expect(sources.rows.map((row) => row.attribution_source)).toEqual(["campaign", "direct", "organic", "referral"]);

      const before = await pool.query<{ count: number }>("select count(*)::int as count from enquiries");
      await expect(pool.query(
        `insert into enquiries (
           id, public_reference, clinic_id, form_key, form_version, idempotency_key, payload_digest,
           name, contact_number, reason, attribution_source, notice_version, status, is_synthetic, created_at
         ) values (
           '11111111-1111-4111-8111-111111111199', 'TEST-DUP', 'harbourview-dental', 'appointment-enquiry', 1, $1, 'other',
           'Other', '00000000', 'general-enquiry', 'direct', 'fixture-notice-v1', 'new', true, now()
         )`,
        [HARBOUR_DUPLICATE_KEY],
      )).rejects.toThrow(/duplicate key/);
      expect((await pool.query<{ count: number }>("select count(*)::int as count from enquiries")).rows[0]?.count).toBe(before.rows[0]?.count);

      const shape = await pool.query<{ id: string }>(
        `insert into enquiries (
           public_reference, clinic_id, form_key, form_version, idempotency_key, payload_digest,
           name, contact_number, reason, notice_version, consent_acknowledged_at, is_synthetic
         ) values ($1, $2, 'appointment-enquiry', 1, $3, 'test', 'Test submission', '00000000', 'Test submission', 'test', now(), true)
         returning id`,
        ["TEST-SHAPE", "harbourview-dental", "fixture-shape-only"],
      );
      expect(shape.rows[0]?.id).toBeTruthy();
      await pool.query("delete from enquiries where public_reference = 'TEST-SHAPE'");

      const harbourOnly = await pool.query<{ clinic_id: string }>(
        "select clinic_id from enquiries where clinic_id = any($1::text[])",
        [["harbourview-dental"]],
      );
      expect(new Set(harbourOnly.rows.map((row) => row.clinic_id))).toEqual(new Set(["harbourview-dental"]));

      expect(await requeueNotification(url, RETRY_SUCCESS_OUTBOX_ID, ["harbourview-dental"])).toEqual({ id: RETRY_SUCCESS_OUTBOX_ID });
      expect(await requeueNotification(url, RETRY_FAILURE_OUTBOX_ID, ["harbourview-dental"])).toBeNull();
      expect(await requeueNotification(url, RETRY_SUCCESS_OUTBOX_ID, ["northgate-physio"])).toBeNull();
      expect((await pool.query<{ count: number }>("select count(*)::int as count from enquiries")).rows[0]?.count).toBe(6);
      const requeued = await pool.query<{ status: string }>("select status from notification_outbox where id = $1", [RETRY_SUCCESS_OUTBOX_ID]);
      expect(requeued.rows[0]?.status).toBe("pending");
    } finally {
      await pool.end();
    }

    const checked = await checkEnquiryFixture(fixtureUrl);
    expect(checked.enquiries).toBe(6);
  });
});
