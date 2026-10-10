import assert from "node:assert/strict";
import { FakeDb } from "./sarvam-webhook-idempotency.test";
import {
  archivePendingRecordings,
  dialDueCallbacks,
  isWithinCallingWindow,
  purgeExpiredRecordings,
  purgeRecycleBin,
} from "../lib/telephony/scheduler";
import { toCampaignPayload } from "../lib/telephony/outbound-webhook";
import { buildBusinessDetailsMessage } from "../lib/messaging/business-details";
import { sendBusinessDetails } from "../lib/messaging/send-business-details";

const BUSINESS_ID = "b0000000-0000-4000-8000-0000000000aa";
const CAMPAIGN_ID = "c0000000-0000-4000-8000-0000000000aa";
const CONTACT_ID = "d0000000-0000-4000-8000-0000000000aa";

/** IST wall-clock time as a Date (IST = UTC+05:30). */
function ist(isoLocal: string): Date {
  return new Date(`${isoLocal}+05:30`);
}

function seedMessagingDb(opts: { dnc?: boolean } = {}) {
  const db = new FakeDb();
  db.rows("businesses").push({
    id: BUSINESS_ID,
    business_name: "Dixit Institutions",
    description: "Affordable programming courses for students.",
    website: "https://dixit.example",
    business_phone: "+919876543210",
    business_email: null,
  });
  db.rows("campaigns").push({
    id: CAMPAIGN_ID,
    business_id: BUSINESS_ID,
    offering_type: "Python course for students",
    description: "1-month Python course\nfor just Rs 199.",
  });
  db.rows("contacts").push({
    id: CONTACT_ID,
    business_id: BUSINESS_ID,
    name: "Deekshith",
    phone: "9676000000",
    is_dnc: opts.dnc ?? false,
  });
  db.rows("campaign_sources").push({ campaign_id: CAMPAIGN_ID, raw_text: "Includes 5 projects." });
  return db;
}

const asClient = (db: FakeDb) => db as unknown as Parameters<typeof sendBusinessDetails>[1];

export async function runAutomationAndMessagingTests() {
  console.log("==================================================");
  console.log("RUNNING SUITE: AUTOMATION & WHATSAPP DETAILS");
  console.log("==================================================\n");

  // 1. Calling window (IST, campaign window, days, TRAI 09:00-21:00)
  const window = { calling_start_time: "10:00:00", calling_end_time: "18:30:00", calling_days: [1, 2, 3, 4, 5, 6] };
  assert.equal(isWithinCallingWindow(ist("2026-10-08T10:30:00"), window), true); // Thursday 10:30
  assert.equal(isWithinCallingWindow(ist("2026-10-08T09:30:00"), window), false); // before campaign start
  assert.equal(isWithinCallingWindow(ist("2026-10-08T18:45:00"), window), false); // after campaign end
  assert.equal(isWithinCallingWindow(ist("2026-10-11T11:00:00"), window), false); // Sunday
  assert.equal(isWithinCallingWindow(ist("2026-10-08T21:30:00"), null), false); // after TRAI window
  assert.equal(isWithinCallingWindow(ist("2026-10-08T08:59:00"), null), false); // before TRAI window
  console.log("  ✅ Callbacks only dial inside the campaign window and 09:00-21:00 IST");

  // 2. Callback results convert to the campaign webhook shape
  const converted = toCampaignPayload({
    attempt_id: "att_cb_1",
    status: "connected",
    duration: 40,
    final_agent_variables: { dnc_requested: "no", call_outcome: "INTERESTED" },
    webhook_config: {
      metadata: { callback_id: "cb1", contact_id: CONTACT_ID, campaign_id: CAMPAIGN_ID, user_phone_number: "9676000000" },
    },
  });
  assert.ok(converted);
  assert.equal(converted.campaign_id, CAMPAIGN_ID);
  assert.equal(converted.user_identifier, CONTACT_ID);
  assert.equal(converted.completion_status, "completed");
  assert.equal(toCampaignPayload({ attempt_id: "x", status: "busy" }), null);
  console.log("  ✅ Callback call results are recorded like campaign calls");

  // 3. WhatsApp template parameters are single-line
  const message = buildBusinessDetailsMessage({
    business: {
      business_name: "Dixit Institutions",
      description: "Line one\nline two",
      website: null,
      business_phone: "+919876543210",
      business_email: null,
    },
    campaign: { offering_type: "Python course", description: "Rs 199\n\nfor 1 month" },
    sources: [{ raw_text: "5 projects\tincluded" }],
    customerName: "Deekshith",
  });
  for (const value of Object.values(message)) {
    assert.ok(!/[\n\r\t]/.test(value) && !/\s{2,}/.test(value), `Template param must be one clean line: ${value}`);
  }
  assert.ok(message.details.includes("Rs 199 for 1 month"));
  console.log("  ✅ WhatsApp details are flattened to valid template parameters");

  // 4. Send-details rules
  const previousToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const previousPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const previousFetch = globalThis.fetch;
  try {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;

    const unconfigured = seedMessagingDb();
    const notConfigured = await sendBusinessDetails(
      { contactId: CONTACT_ID, campaignId: CAMPAIGN_ID },
      asClient(unconfigured)
    );
    assert.equal(notConfigured.status, "not_configured");
    assert.equal(unconfigured.rows("message_logs")[0].status, "not_configured");
    console.log("  ✅ Without WhatsApp configured the request is logged and the agent says the team will follow up");

    const dncDb = seedMessagingDb({ dnc: true });
    const dnc = await sendBusinessDetails({ contactId: CONTACT_ID, campaignId: CAMPAIGN_ID }, asClient(dncDb));
    assert.equal(dnc.status, "skipped");
    console.log("  ✅ Contacts on the DNC list are never messaged");

    process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
    const sentRequests: Array<{ url: string; body: Record<string, unknown> }> = [];
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      sentRequests.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ messages: [{ id: "wamid.TEST" }] }), { status: 200 });
    }) as typeof fetch;

    const configured = seedMessagingDb();
    const first = await sendBusinessDetails({ contactId: CONTACT_ID, campaignId: CAMPAIGN_ID }, asClient(configured));
    const second = await sendBusinessDetails({ contactId: CONTACT_ID, campaignId: CAMPAIGN_ID }, asClient(configured));
    assert.equal(first.status, "sent");
    assert.equal(second.status, "already_sent");
    assert.equal(sentRequests.length, 1);
    assert.equal((sentRequests[0].body as { to: string }).to, "919676000000");
    console.log("  ✅ Details are sent once to the number on record; repeats within 24h are not resent");

    const foreignCampaign = seedMessagingDb();
    foreignCampaign.rows("campaigns")[0].business_id = "b0000000-0000-4000-8000-0000000000bb";
    const crossTenant = await sendBusinessDetails(
      { contactId: CONTACT_ID, campaignId: CAMPAIGN_ID },
      asClient(foreignCampaign)
    );
    assert.equal(crossTenant.status, "skipped");
    console.log("  ✅ A contact and campaign from different businesses are rejected");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN;
    else process.env.WHATSAPP_ACCESS_TOKEN = previousToken;
    if (previousPhoneId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    else process.env.WHATSAPP_PHONE_NUMBER_ID = previousPhoneId;
  }

  // 5. Callback rules: hold for paused campaigns, cancel for deleted ones,
  //    expire ones long past their time. None of these reach the dialler.
  const cbDb = new FakeDb();
  const tickAt = ist("2026-10-09T11:30:00"); // Friday, inside the calling window
  cbDb.rows("businesses").push({ id: BUSINESS_ID, business_name: "Dixit Institutions" });
  cbDb.rows("subscriptions").push({ business_id: BUSINESS_ID, status: "ACTIVE" });
  cbDb.rows("contacts").push({ id: CONTACT_ID, business_id: BUSINESS_ID, name: "D", phone: "+919676000000", is_dnc: false, is_wrong_number: false });
  cbDb.rows("campaigns").push(
    { id: "camp-paused", business_id: BUSINESS_ID, status: "PAUSED", deleted_at: null, calling_start_time: "10:00:00", calling_end_time: "18:30:00", calling_days: [1, 2, 3, 4, 5, 6] },
    { id: "camp-deleted", business_id: BUSINESS_ID, status: "READY", deleted_at: "2026-10-08T00:00:00Z", calling_start_time: "10:00:00", calling_end_time: "18:30:00", calling_days: [1, 2, 3, 4, 5, 6] }
  );
  const callback = (id: string, campaignId: string, scheduledFor: string) => ({
    id, business_id: BUSINESS_ID, campaign_id: campaignId, contact_id: CONTACT_ID,
    status: "SCHEDULED", dial_attempts: 0, scheduled_for: scheduledFor, notes: "Requested on call",
  });
  cbDb.rows("callbacks").push(
    callback("cb-paused", "camp-paused", "2026-10-09T05:00:00.000Z"),
    callback("cb-deleted", "camp-deleted", "2026-10-09T05:00:00.000Z"),
    callback("cb-stale", "camp-paused", "2026-10-06T05:00:00.000Z")
  );
  const cbErrors: string[] = [];
  const dialedCount = await dialDueCallbacks(
    cbDb as unknown as Parameters<typeof dialDueCallbacks>[0],
    tickAt,
    cbErrors
  );
  const byId = (id: string) => cbDb.rows("callbacks").find((r) => r.id === id)!;
  assert.equal(dialedCount, 0);
  assert.deepEqual(cbErrors, []);
  assert.equal(byId("cb-paused").status, "SCHEDULED");
  assert.equal(byId("cb-deleted").status, "CANCELLED");
  assert.equal(byId("cb-stale").status, "MISSED");
  assert.ok(String(byId("cb-stale").notes).startsWith("Requested on call | "));
  console.log("  ✅ Callbacks wait while the campaign is paused, cancel if it was deleted, expire after 48h");

  // 6. Recordings: copied from Sarvam into private storage, then expired
  const savedEnv = {
    org: process.env.SARVAM_ORG_ID,
    ws: process.env.SARVAM_WORKSPACE_ID,
    key: process.env.SARVAM_VOICE_AGENTS_API_KEY,
    app: process.env.SARVAM_AGENT_APP_ID,
    mock: process.env.SARVAM_MOCK_MODE,
  };
  const fetchBefore = globalThis.fetch;
  try {
    process.env.SARVAM_ORG_ID = "org-test";
    process.env.SARVAM_WORKSPACE_ID = "ws-test";
    process.env.SARVAM_VOICE_AGENTS_API_KEY = "sk_test_recordings";
    process.env.SARVAM_AGENT_APP_ID = "Outreach-Ag-test";
    process.env.SARVAM_MOCK_MODE = "false";

    const requested: string[] = [];
    globalThis.fetch = (async (url: string) => {
      requested.push(String(url));
      return new Response(new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0]), {
        status: 200,
        headers: { "content-type": "audio/wav" },
      });
    }) as typeof fetch;

    const recDb = new FakeDb();
    const recNow = new Date("2026-10-10T06:00:00.000Z");
    const minutesAgo = (m: number) => new Date(recNow.getTime() - m * 60_000).toISOString();
    recDb.rows("subscriptions").push({ business_id: BUSINESS_ID, limits: { recording_retention_days: 30 } });
    recDb.rows("calls").push(
      { id: "call-ready", business_id: BUSINESS_ID, provider_interaction_id: "20261010/abc-12:00:00-x", provider_attempt_id: null, duration_seconds: 40, created_at: minutesAgo(10) },
      { id: "call-too-new", business_id: BUSINESS_ID, provider_interaction_id: "20261010/new", provider_attempt_id: null, duration_seconds: 20, created_at: new Date(recNow.getTime() - 20_000).toISOString() },
      { id: "call-not-connected", business_id: BUSINESS_ID, provider_interaction_id: null, provider_attempt_id: null, duration_seconds: 0, created_at: minutesAgo(10) }
    );

    const recErrors: string[] = [];
    const archived = await archivePendingRecordings(
      recDb as unknown as Parameters<typeof archivePendingRecordings>[0],
      recNow,
      recErrors
    );
    assert.deepEqual(recErrors, []);
    assert.equal(archived, 1);
    assert.equal(requested.length, 1);
    assert.ok(
      requested[0].endsWith(
        "/api/analytics/v1/org-test/ws-test/Outreach-Ag-test/recordings/20261010%2Fabc-12%3A00%3A00-x"
      ),
      requested[0]
    );
    assert.ok(recDb.files.get("call-recordings")!.has(`${BUSINESS_ID}/call-ready.wav`));
    const saved = recDb.rows("call_recordings")[0];
    assert.equal(saved.storage_path, `${BUSINESS_ID}/call-ready.wav`);
    const retentionDays = (Date.parse(String(saved.expires_at)) - Date.now()) / 86_400_000;
    assert.ok(retentionDays > 29.9 && retentionDays <= 30, `retention ${retentionDays}`);
    console.log("  ✅ Recordings are saved to private storage after the call, with the plan's retention");

    recDb.rows("call_recordings").push({
      id: "rec-old",
      call_id: "call-old",
      storage_path: `${BUSINESS_ID}/call-old.wav`,
      expires_at: "2026-10-01T00:00:00.000Z",
    });
    recDb.files.get("call-recordings")!.set(`${BUSINESS_ID}/call-old.wav`, 8);
    const expiredCount = await purgeExpiredRecordings(
      recDb as unknown as Parameters<typeof purgeExpiredRecordings>[0],
      recNow,
      recErrors
    );
    assert.equal(expiredCount, 1);
    assert.ok(!recDb.files.get("call-recordings")!.has(`${BUSINESS_ID}/call-old.wav`));
    assert.equal(recDb.rows("call_recordings").length, 1);
    console.log("  ✅ Expired recordings are deleted from storage and the database");
  } finally {
    globalThis.fetch = fetchBefore;
    const restore = (key: string, value: string | undefined) =>
      value === undefined ? delete process.env[key] : (process.env[key] = value);
    restore("SARVAM_ORG_ID", savedEnv.org);
    restore("SARVAM_WORKSPACE_ID", savedEnv.ws);
    restore("SARVAM_VOICE_AGENTS_API_KEY", savedEnv.key);
    restore("SARVAM_AGENT_APP_ID", savedEnv.app);
    restore("SARVAM_MOCK_MODE", savedEnv.mock);
  }

  // 7. Recycle bin purge keeps recent and running campaigns
  const purgeDb = new FakeDb();
  const now = new Date("2026-10-08T06:00:00Z");
  purgeDb.rows("campaigns").push(
    { id: "old", status: "DRAFT", deleted_at: "2026-08-01T00:00:00.000Z" },
    { id: "recent", status: "DRAFT", deleted_at: "2026-10-01T00:00:00.000Z" },
    { id: "live", status: "READY", deleted_at: null }
  );
  const purged = await purgeRecycleBin(
    purgeDb as unknown as Parameters<typeof purgeRecycleBin>[0],
    now,
    []
  );
  assert.equal(purged, 1);
  assert.deepEqual(purgeDb.rows("campaigns").map((c) => c.id).sort(), ["live", "recent"]);
  console.log("  ✅ Recycle bin removes only campaigns deleted more than 30 days ago\n");

  console.log("==================================================");
  console.log("ALL AUTOMATION & WHATSAPP TESTS PASSED!");
  console.log("==================================================\n");
}
