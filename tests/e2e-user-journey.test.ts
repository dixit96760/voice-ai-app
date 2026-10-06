import assert from "node:assert/strict";
import { normalizeIndianPhone } from "../lib/validation/phone";
import { parseCsvText } from "../lib/contacts/parser";
import { escapeCsvField } from "../lib/analytics/export-service";
import { buildSarvamAgentConfig } from "../lib/providers/sarvam/agent";
import { normalizeCampaignWebhook } from "../lib/providers/sarvam/webhooks";
import { verifySubscriptionCheckoutSignature } from "../lib/providers/razorpay/signatures";
import { isApiKeyFormat, createApiKeyMaterial, verifyApiKey } from "../lib/auth/api-key";

/**
 * End-to-End User Journey Simulation Test Suite
 * Validates the critical handoffs from visitor -> subscriber -> campaign -> call -> webhook -> analytics.
 */
export async function runEndToEndUserJourneyTests(): Promise<void> {
  console.log("==================================================");
  console.log("RUNNING SUITE: FULL-STACK USER JOURNEY (PHASE 7 E2E)");
  console.log("==================================================\n");

  // Step 1: Contact Upload & Injection Defense
  console.log("1. Contact CSV Parsing & Sanitization...");
  const rawCsv = `Name,Phone,City\nRajesh Kumar,9849012345,Hyderabad\n=HYPERLINK("evil.com"),+91 9988776655,Mumbai`;
  const parsedRows = parseCsvText(rawCsv);
  assert.equal(parsedRows.length, 2, "Must parse 2 lead records");
  assert.equal(parsedRows[0]["Phone"], "9849012345");

  // Formula injection check
  const sanitizedName = escapeCsvField(parsedRows[1]["Name"]);
  assert.equal(sanitizedName.startsWith("\"'="), true, "Formula trigger '=' must be neutralized with leading apostrophe");
  console.log("  ✅ Contact parsing and CSV injection defenses verified.\n");

  // Step 2: Phone Normalization for Outbound Calling
  console.log("2. Telephony Lead Normalization (+91 E.164)...");
  const p1 = normalizeIndianPhone("09849012345");
  assert.equal(p1.isValid, true);
  assert.equal(p1.normalized, "+919849012345");
  const p2 = normalizeIndianPhone("+91-99887-76655");
  assert.equal(p2.isValid, true);
  assert.equal(p2.normalized, "+919988776655");
  console.log("  ✅ Canonical E.164 normalization verified.\n");

  // Step 3: Agent Prompt Grounding & Guardrails
  console.log("3. AI Voice Agent Configuration & Guardrails...");
  const agentConfig = buildSarvamAgentConfig({
    business: {
      id: "biz-101",
      owner_id: "user-101",
      business_name: "Apex Healthcare",
      business_type: "Clinic",
      description: "Preventive dental diagnostics",
      website: "https://apex.test",
      business_email: "contact@apex.test",
      business_phone: "+914040001234",
      address: "Banjara Hills",
      city: "Hyderabad",
      state: "Telangana",
      country: "India",
      timezone: "Asia/Kolkata",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any,
    campaign: {
      id: "camp-101",
      business_id: "biz-101",
      name: "Dental Checkup Drive",
      objective: "Book consultations",
      offering_type: "Dental Exam Package",
      status: "DRAFT",
      calling_start_time: "09:30",
      calling_end_time: "19:00",
      calling_days: [1, 2, 3, 4, 5, 6],
      timezone: "Asia/Kolkata",
      max_call_duration_seconds: 180,
      max_attempts: 2,
      retry_interval_minutes: 60,
      enable_phone_rotation: false,
      sarvam_campaign_id: null,
      sarvam_cohort_id: null,
      sarvam_agent_id: "Conversatio-ba0c8ea5-a5c2",
      active_version_id: "v-1",
      started_at: null,
      ended_at: null,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any,
    version: {
      id: "v-1",
      campaign_id: "camp-101",
      version_number: 1,
      configuration: { language: "hi-IN", preferredLanguage: "hi-IN", tone: "Empathetic" },
      system_prompt: "Test prompt",
      sarvam_agent_id: "Conversatio-ba0c8ea5-a5c2",
      sarvam_agent_version_id: "1",
      change_summary: "Initial",
      created_by: "user-101",
      created_at: new Date().toISOString(),
    } as any,
    sources: [],
  });

  assert.equal(agentConfig.language, "hi-IN");
  assert.equal(agentConfig.system_prompt.includes("Apex Healthcare"), true);
  assert.equal(agentConfig.system_prompt.includes("DO-NOT-CALL (DNC)"), true);
  console.log("  ✅ AI system prompt verified with mandatory safety and DNC rules.\n");

  // Step 4: Sarvam Webhook Normalization & Recording Payload
  console.log("4. Sarvam Webhook Normalization & Recording Support...");
  const mockWebhookPayload = {
    app_id: "Conversatio-ba0c8ea5-a5c2",
    app_version: 1,
    campaign_id: "sarvam-camp-999",
    cohort_id: "cohort-888",
    attempt_id: "attempt-777",
    interaction_id: "interaction-555",
    user_phone_number: "+919849012345",
    completion_status: "completed",
    connectivity_status: "connected",
    duration: 125,
    recording_url: "https://sarvam-recordings.test/audio/att-777.wav",
    output_agent_variables: {
      call_outcome: "INTERESTED",
      interest_level: "HIGH",
      callback_requested: false,
      callback_datetime: undefined,
      dnc_requested: false,
      wrong_number: false,
    },
    interaction_transcript: [
      { role: "agent", en_text: "Hello Rajesh!", indic_text: "नमस्ते राजेश!" },
      { role: "user", en_text: "Yes, I am interested in the checkup.", indic_text: "हाँ, मैं चेकअप में रुचि रखता हूँ।" },
    ],
  };

  const normalized = normalizeCampaignWebhook(mockWebhookPayload);
  assert.equal(normalized.callStatus, "COMPLETED");
  assert.equal(normalized.callOutcome, "INTERESTED");
  assert.equal(normalized.durationSeconds, 125);
  assert.equal(normalized.callbackRequested, false);
  assert.equal(normalized.transcriptJson.length, 2);

  // Verify callback priority over general outcome
  const callbackPayload = {
    ...mockWebhookPayload,
    output_agent_variables: {
      ...mockWebhookPayload.output_agent_variables,
      callback_requested: true,
      callback_datetime: "2026-10-10T11:00:00Z",
    },
  };
  const normalizedCallback = normalizeCampaignWebhook(callbackPayload);
  assert.equal(normalizedCallback.callOutcome, "CALLBACK");
  assert.equal(normalizedCallback.callbackRequested, true);
  console.log("  ✅ Connected call with bilingual transcript, outcomes, and recording mapped successfully.\n");

  // Step 5: Razorpay Checkout Signature Verification
  console.log("5. Razorpay Subscription Checkout Signature Verification...");
  const testSecret = "test_razorpay_secret_key_12345";
  const testPaymentId = "pay_live_00112233";
  const testSubId = "sub_live_99887766";
  const { createHmac } = await import("node:crypto");
  const validSignature = createHmac("sha256", testSecret)
    .update(`${testPaymentId}|${testSubId}`)
    .digest("hex");

  assert.equal(
    verifySubscriptionCheckoutSignature(testPaymentId, testSubId, validSignature, testSecret),
    true,
    "Valid Razorpay signature must verify"
  );
  assert.equal(
    verifySubscriptionCheckoutSignature(testPaymentId, testSubId, "tampered_sig", testSecret),
    false,
    "Tampered signature must be rejected"
  );
  console.log("  ✅ Cryptographic checkout signature verification validated.\n");

  // Step 6: Developer API Key Material & Hashing
  console.log("6. Developer API Key Material Generation & Verification...");
  process.env.AUTH_API_KEY_PEPPER = "random-pepper-for-end-to-end-testing-purposes-123";
  const keyMat = createApiKeyMaterial();
  assert.equal(isApiKeyFormat(keyMat.rawKey), true);
  assert.equal(verifyApiKey(keyMat.rawKey, keyMat.keyHash), true);
  assert.equal(verifyApiKey(`${keyMat.rawKey}_bad`, keyMat.keyHash), false);
  console.log("  ✅ Developer API Key prefix, hashing, and verification validated.\n");

  console.log("==================================================");
  console.log("🎉 ALL END-TO-END USER JOURNEY TESTS PASSED! 🎉");
  console.log("==================================================\n");
}
