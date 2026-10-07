import assert from "node:assert/strict";
import { processCampaignWebhook } from "../lib/telephony/webhook-service";
import type { SarvamCampaignWebhookPayload } from "../lib/providers/sarvam/types";

type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;

/**
 * Minimal in-memory stand-in for the Supabase query builder, covering the
 * calls the webhook processor makes. Unique constraints mirror the database.
 */
class FakeDb {
  tables = new Map<string, Row[]>();
  uniqueKeys: Record<string, string[][]> = {
    webhook_events: [["provider", "provider_event_id"]],
    calls: [["provider", "provider_attempt_id"]],
    call_transcripts: [["call_id"]],
    call_recordings: [["call_id"]],
    call_analysis: [["call_id"]],
    dnc_numbers: [["business_id", "phone_number"]],
  };
  /** Table name whose next insert should fail, to simulate an outage. */
  failNextInsertInto: string | null = null;
  private nextId = 1;

  rows(table: string): Row[] {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }

  newId(): string {
    const n = (this.nextId++).toString(16).padStart(12, "0");
    return `00000000-0000-4000-8000-${n}`;
  }

  conflicts(table: string, row: Row, keys: string[]): Row | undefined {
    if (keys.some((k) => row[k] === null || row[k] === undefined)) return undefined;
    return this.rows(table).find((r) => keys.every((k) => r[k] === row[k]));
  }

  from(table: string) {
    return new FakeQuery(this, table);
  }
}

class FakeQuery {
  private op: "select" | "insert" | "update" | "upsert" = "select";
  private payload: Row[] = [];
  private onConflict: string[] = [];
  private filters: Filter[] = [];
  private mode: "many" | "single" | "maybeSingle" = "many";
  private max = Infinity;

  constructor(private db: FakeDb, private table: string) {}

  select() {
    return this;
  }
  insert(values: Row | Row[]) {
    this.op = "insert";
    this.payload = Array.isArray(values) ? values : [values];
    return this;
  }
  upsert(values: Row | Row[], opts?: { onConflict?: string }) {
    this.op = "upsert";
    this.payload = Array.isArray(values) ? values : [values];
    this.onConflict = (opts?.onConflict || "id").split(",");
    return this;
  }
  update(values: Row) {
    this.op = "update";
    this.payload = [values];
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  is(col: string, val: unknown) {
    this.filters.push((r) => (r[col] ?? null) === val);
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push((r) => vals.includes(r[col]));
    return this;
  }
  order() {
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }
  maybeSingle() {
    this.mode = "maybeSingle";
    return this;
  }

  then<T>(resolve: (value: { data: unknown; error: unknown }) => T) {
    return Promise.resolve(this.execute()).then(resolve);
  }

  private shape(rows: Row[]) {
    if (this.mode === "many") return { data: rows.slice(0, this.max), error: null };
    if (rows.length === 0) {
      return this.mode === "single"
        ? { data: null, error: { code: "PGRST116", message: "No rows" } }
        : { data: null, error: null };
    }
    return { data: rows[0], error: null };
  }

  private execute() {
    const table = this.db.rows(this.table);
    const matches = () => table.filter((r) => this.filters.every((f) => f(r)));

    if (this.op === "select") return this.shape(matches());

    if (this.op === "update") {
      const hit = matches();
      for (const r of hit) Object.assign(r, this.payload[0]);
      return this.shape(hit);
    }

    if (this.db.failNextInsertInto === this.table) {
      this.db.failNextInsertInto = null;
      return { data: null, error: { code: "08006", message: "connection lost" } };
    }

    const written: Row[] = [];
    for (const values of this.payload) {
      if (this.op === "upsert") {
        const existing = this.db.conflicts(this.table, values, this.onConflict);
        if (existing) {
          Object.assign(existing, values);
          written.push(existing);
          continue;
        }
      }
      for (const keys of this.db.uniqueKeys[this.table] || []) {
        if (this.db.conflicts(this.table, values, keys)) {
          return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
      }
      const row = { id: this.db.newId(), ...values };
      table.push(row);
      written.push(row);
    }
    return this.shape(written);
  }
}

const BUSINESS_ID = "b0000000-0000-4000-8000-000000000001";
const CAMPAIGN_ID = "c0000000-0000-4000-8000-000000000001";
const CONTACT_ID = "d0000000-0000-4000-8000-000000000001";

function seed(db: FakeDb, opts: { sarvamCampaignId: string | null }) {
  db.rows("campaigns").push({
    id: CAMPAIGN_ID,
    business_id: BUSINESS_ID,
    sarvam_campaign_id: opts.sarvamCampaignId,
  });
  db.rows("contacts").push({ id: CONTACT_ID, business_id: BUSINESS_ID, phone: "+919876543210" });
  db.rows("campaign_contacts").push({
    id: "e0000000-0000-4000-8000-000000000001",
    campaign_id: CAMPAIGN_ID,
    contact_id: CONTACT_ID,
    attempt_count: 0,
  });
}

function payload(overrides: Partial<SarvamCampaignWebhookPayload> = {}): SarvamCampaignWebhookPayload {
  return {
    app_id: "app_1",
    campaign_id: "sarvam_campaign_1",
    cohort_id: "cohort_1",
    attempt_id: "attempt_1",
    user_identifier: CONTACT_ID,
    user_phone_number: "+919876543210",
    completion_status: "completed",
    connectivity_status: "connected",
    duration: 95,
    interaction_transcript: [{ role: "agent", content: "Namaste" }] as never,
    output_agent_variables: { dnc_requested: true },
    ...overrides,
  };
}

// The fake implements only what the processor uses; the cast is test-only.
const asClient = (db: FakeDb) => db as unknown as Parameters<typeof processCampaignWebhook>[2];

export async function runSarvamWebhookIdempotencyTests() {
  console.log("==================================================");
  console.log("RUNNING SUITE: SARVAM WEBHOOK IDEMPOTENCY");
  console.log("==================================================\n");

  // 1. Duplicate delivery records the call and billable usage exactly once
  {
    const db = new FakeDb();
    seed(db, { sarvamCampaignId: "sarvam_campaign_1" });

    const first = await processCampaignWebhook(payload(), {}, asClient(db));
    const second = await processCampaignWebhook(payload(), {}, asClient(db));

    assert.equal(first.success, true);
    assert.equal(second.success, true);
    assert.equal(second.alreadyProcessed, true);
    assert.equal(db.rows("calls").length, 1);
    assert.equal(db.rows("usage_events").length, 3);
    assert.equal(db.rows("campaign_contacts")[0].attempt_count, 1);
    assert.equal(db.rows("dnc_numbers").length, 1);
    console.log("  ✅ Duplicate delivery recorded one call, one attempt count, one set of usage");
  }

  // 2. A delivery that fails part-way is retried and completed without duplicates
  {
    const db = new FakeDb();
    seed(db, { sarvamCampaignId: "sarvam_campaign_1" });

    db.failNextInsertInto = "usage_events";
    const failed = await processCampaignWebhook(payload(), {}, asClient(db));
    assert.equal(failed.success, false);
    assert.equal(failed.retryable, true);
    assert.equal(db.rows("webhook_events")[0].status, "FAILED");
    assert.equal(db.rows("usage_events").length, 0);

    const retried = await processCampaignWebhook(payload(), {}, asClient(db));
    assert.equal(retried.success, true);
    assert.equal(db.rows("calls").length, 1);
    assert.equal(db.rows("call_attempts").length, 1);
    assert.equal(db.rows("call_transcripts").length, 1);
    assert.equal(db.rows("usage_events").length, 3);
    assert.equal(db.rows("campaign_contacts")[0].attempt_count, 1);
    assert.equal(db.rows("webhook_events")[0].status, "PROCESSED");
    console.log("  ✅ Failed delivery is retryable and resumes without duplicating the call or usage");
  }

  // 3. A concurrent delivery while another processor holds the claim is deferred
  {
    const db = new FakeDb();
    seed(db, { sarvamCampaignId: "sarvam_campaign_1" });
    db.rows("webhook_events").push({
      id: db.newId(),
      provider: "sarvam",
      provider_event_id: "attempt_1",
      status: "PROCESSING",
      processed: false,
      processing_started_at: new Date().toISOString(),
    });

    const concurrent = await processCampaignWebhook(payload(), {}, asClient(db));
    assert.equal(concurrent.success, false);
    assert.equal(concurrent.retryable, true);
    assert.equal(db.rows("calls").length, 0);
    console.log("  ✅ In-flight delivery is deferred instead of processed twice");
  }

  // 4. Campaign matched by our own UUID (fallback lookup) is attributed correctly
  {
    const db = new FakeDb();
    seed(db, { sarvamCampaignId: null });

    const result = await processCampaignWebhook(
      payload({ campaign_id: CAMPAIGN_ID, output_agent_variables: {} }),
      {},
      asClient(db)
    );
    assert.equal(result.success, true);
    assert.equal(db.rows("calls")[0].business_id, BUSINESS_ID);
    assert.equal(db.rows("calls")[0].campaign_id, CAMPAIGN_ID);
    console.log("  ✅ Fallback campaign lookup attributes the call to the right business");
  }

  // 5. Unknown campaign is acknowledged as permanent, not retried
  {
    const db = new FakeDb();
    seed(db, { sarvamCampaignId: "sarvam_campaign_1" });

    const result = await processCampaignWebhook(
      payload({ campaign_id: "unknown_campaign" }),
      {},
      asClient(db)
    );
    assert.equal(result.success, false);
    assert.equal(result.retryable, false);
    assert.equal(db.rows("webhook_events")[0].status, "IGNORED");
    assert.equal(db.rows("calls").length, 0);
    console.log("  ✅ Unknown campaign is recorded and not retried");
  }

  // 6. A call whose contact has no campaign link still records its attempt
  {
    const db = new FakeDb();
    seed(db, { sarvamCampaignId: "sarvam_campaign_1" });

    await processCampaignWebhook(
      payload({ user_identifier: null, user_phone_number: "+919000000001", output_agent_variables: {} }),
      {},
      asClient(db)
    );
    assert.equal(db.rows("contacts").length, 2);
    assert.equal(db.rows("call_attempts").length, 1);
    assert.equal(db.rows("call_attempts")[0].campaign_contact_id, null);
    console.log("  ✅ Unlinked contact's call attempt is recorded with no campaign contact\n");
  }

  console.log("==================================================");
  console.log("ALL 6 SARVAM WEBHOOK IDEMPOTENCY TESTS PASSED!");
  console.log("==================================================\n");
}
