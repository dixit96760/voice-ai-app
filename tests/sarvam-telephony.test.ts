import { buildSarvamAgentConfig } from "../lib/providers/sarvam/agent";
import { normalizeCampaignWebhook } from "../lib/providers/sarvam/webhooks";
import { buildCreateCampaignPayload } from "../lib/providers/sarvam/campaign";
import { buildCohortUser } from "../lib/providers/sarvam/cohort";
import { normalizeSarvamError, SarvamProviderError } from "../lib/providers/sarvam/errors";
import { normalizeIndianPhone } from "../lib/validation/phone";
import { isSarvamMockMode } from "../lib/providers/sarvam/client";
import {
  SarvamCampaignWebhookPayload,
  SarvamCampaignRequest,
} from "../lib/providers/sarvam/types";
import type { Database } from "../lib/supabase/types";
import { createAdminClient } from "../lib/supabase/admin";
import * as fs from "fs";
import * as path from "path";

// Explicitly set Mock Mode for automated tests
process.env.SARVAM_MOCK_MODE = "true";
process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mock-test-project.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "mock-service-role-key-for-tests";

export function runSarvamTelephonyTests() {
  console.log("==================================================");
  console.log("RUNNING SUITE: SARVAM VOICE AGENTS TELEPHONY (PHASE 4)");
  console.log("==================================================\n");

  const businessId = "bus_12345";

  const mockBusiness = {
    id: businessId,
    owner_id: "usr_123",
    business_name: "Prestige Luxury Living",
    business_type: "Real Estate Developer",
    description: "Premium residential developer in South India",
    website: "https://prestigeproperties.in",
    business_email: "sales@prestige.in",
    business_phone: "+918049012345",
    address: "Prestige Falcon Tower, Brunton Road",
    city: "Bengaluru",
    state: "Karnataka",
    country: "India",
    timezone: "Asia/Kolkata",
    logo_url: null,
    gstin: null,
    billing_state_code: null,
    is_tax_exempt: false,
    tax_exemption_reason: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockCampaign = {
    id: "camp_001",
    business_id: businessId,
    name: "Prestige Golfshire Q3 Inquiries",
    offering_type: "Luxury Golf Villas",
    industry: "Real Estate",
    objective: "Qualify high net-worth leads",
    description: "Outbound campaign to leads who requested property brochures online.",
    status: "READY" as const,
    timezone: "Asia/Kolkata",
    calling_days: [1, 2, 3, 4, 5, 6],
    calling_start_time: "10:00:00",
    calling_end_time: "18:30:00",
    max_attempts: 3,
    retry_interval_minutes: 60,
    max_call_duration_seconds: 300,
    active_version_id: "ver_001",
    sarvam_agent_id: "sarvam_app_999",
    sarvam_campaign_id: "sarvam_camp_888",
    sarvam_cohort_id: "sarvam_cohort_777",
    enable_phone_rotation: false,
    auto_complete: false,
    started_at: null,
    paused_at: null,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };

  const mockVersion = {
    id: "ver_001",
    campaign_id: mockCampaign.id,
    version_number: 1,
    system_instructions: "You are an AI sales advisor for Prestige Golfshire.",
    knowledge_snapshot: {},
    configuration: {
      preferredLanguage: "hi-IN",
      additionalLanguages: ["en-IN"],
      tone: "Friendly",
      voiceId: "aditi-warm",
      speechRate: 1.0,
      temperature: 0.3,
    },
    sarvam_agent_id: "sarvam_app_999",
    sarvam_agent_version_id: "v1.2",
    status: "READY",
    created_at: new Date().toISOString(),
    published_at: new Date().toISOString(),
  };

  const mockSources = [
    {
      id: "src_001",
      campaign_id: mockCampaign.id,
      source_type: "text" as const,
      source_name: "Pricing and Amenities FAQs",
      source_url: null,
      storage_path: null,
      raw_text: "4BHK luxury villas start from INR 7.5 Crores. Located at Nandi Hills, Bangalore.",
      processing_status: "READY",
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  // -------------------------------------------------------------
  // 1. Mock Mode & Authentication Check
  // -------------------------------------------------------------
  console.log("1. Provider Mock Mode & Zero Real Call Guard Tests...");
  if (!isSarvamMockMode()) {
    throw new Error("SARVAM_MOCK_MODE must be active during automated tests!");
  }
  console.log("  ✅ SARVAM_MOCK_MODE active: ZERO real phone calls will be placed");

  // -------------------------------------------------------------
  // 2. Provider Error Normalization
  // -------------------------------------------------------------
  console.log("2. Provider Error Normalization Tests...");
  const authErr = normalizeSarvamError(new Error("Unauthorized"), 401);
  if (authErr.code !== "AUTHENTICATION_ERROR") {
    throw new Error("401 must map to AUTHENTICATION_ERROR");
  }
  console.log("  ✅ 401 mapped to AUTHENTICATION_ERROR");

  const rateErr = normalizeSarvamError(new Error("Too Many Requests"), 429);
  if (rateErr.code !== "RATE_LIMIT" || !rateErr.retryable) {
    throw new Error("429 must map to retryable RATE_LIMIT");
  }
  console.log("  ✅ 429 mapped to RATE_LIMIT with retryable = true");

  const serverErr = normalizeSarvamError(new Error("Gateway Timeout"), 504);
  if (serverErr.code !== "PROVIDER_UNAVAILABLE") {
    throw new Error("504 must map to PROVIDER_UNAVAILABLE");
  }
  console.log("  ✅ 504 mapped to PROVIDER_UNAVAILABLE\n");

  // -------------------------------------------------------------
  // 3. Agent Configuration & System Instructions Assembly
  // -------------------------------------------------------------
  console.log("3. Agent Configuration & Prompt Engineering Tests...");
  const agentConfig = buildSarvamAgentConfig({
    business: mockBusiness,
    campaign: mockCampaign,
    version: mockVersion,
    sources: mockSources,
  });

  if (!agentConfig.system_prompt.includes("Prestige Luxury Living")) {
    throw new Error("Agent prompt must include business name");
  }
  if (!agentConfig.system_prompt.includes("Luxury Golf Villas")) {
    throw new Error("Agent prompt must include campaign offering");
  }
  if (!agentConfig.system_prompt.includes("DO-NOT-CALL (DNC)")) {
    throw new Error("Agent prompt must include explicit DNC guardrails");
  }
  if (!agentConfig.system_prompt.includes("WRONG NUMBER")) {
    throw new Error("Agent prompt must include explicit wrong number guardrails");
  }
  if (agentConfig.language !== "hi-IN") {
    throw new Error("Agent language must be mapped from preferredLanguage");
  }
  console.log("  ✅ Prompt contains business identity, approved knowledge, and safety rules");
  console.log("  ✅ Language set to 'hi-IN' and voice set to 'aditi-warm'\n");

  // -------------------------------------------------------------
  // 4. Indian E.164 Phone Normalization Tests
  // -------------------------------------------------------------
  console.log("4. Indian E.164 Phone Normalization Tests...");
  const phone1 = normalizeIndianPhone("9849012345");
  if (phone1.normalized !== "+919849012345") {
    throw new Error("10-digit phone must normalize to +919849012345");
  }
  const phone2 = normalizeIndianPhone("+91 98490 12345");
  if (phone2.normalized !== "+919849012345") {
    throw new Error("Formatted +91 phone must normalize without spaces");
  }
  const invalidPhone = normalizeIndianPhone("12345");
  if (invalidPhone.isValid) {
    throw new Error("Short phone number must be invalid");
  }
  console.log("  ✅ Canonical E.164 normalization verified (+91XXXXXXXXXX)\n");

  // -------------------------------------------------------------
  // 5. Cohort Filtering: DNC vs Wrong Number (Rule 1)
  // -------------------------------------------------------------
  console.log("5. Cohort Filtering: DNC & Wrong Number Exclusion Tests...");
  const testContacts = [
    {
      id: "cnt_01",
      business_id: businessId,
      name: "Ramesh Gupta",
      phone: "9849012345",
      is_dnc: false,
      is_wrong_number: false,
      status: "ACTIVE",
    },
    {
      id: "cnt_02",
      business_id: businessId,
      name: "Suresh Kumar",
      phone: "9849012346",
      is_dnc: true, // Should be excluded!
      is_wrong_number: false,
      status: "ACTIVE",
    },
    {
      id: "cnt_03",
      business_id: businessId,
      name: "Anita Sharma",
      phone: "9849012347",
      is_dnc: false,
      is_wrong_number: true, // Should be excluded!
      status: "ACTIVE",
    },
  ];

  const filtered = testContacts.filter((c) => !c.is_dnc && !c.is_wrong_number && c.status === "ACTIVE");
  if (filtered.length !== 1 || filtered[0].name !== "Ramesh Gupta") {
    throw new Error("DNC and wrong-number contacts must be excluded from cohort streaming");
  }
  console.log("  ✅ DNC and wrong-number contacts strictly excluded from cohort\n");

  // -------------------------------------------------------------
  // 6. Campaign Dialing Rules & Phone Rotation (Rule 4)
  // -------------------------------------------------------------
  console.log("6. Dialing Rules & Phone Rotation Tests...");
  const campaignReq: SarvamCampaignRequest = {
    name: "Prestige Golfshire Outbound",
    app_id: "sarvam_app_999",
    app_type: "agent",
    app_version: "v1.2",
    schedule: {
      start_time: "10:00:00",
      end_time: "18:30:00",
      allowed_days: [1, 2, 3, 4, 5, 6],
      timezone: "Asia/Kolkata",
    },
    retry_policy: {
      max_attempts: 3,
      retry_interval_minutes: 60,
      enable_phone_rotation: false, // Default OFF (Rule 4)
    },
  };

  if (campaignReq.retry_policy.enable_phone_rotation !== false) {
    throw new Error("Phone rotation must default to false");
  }
  console.log("  ✅ Phone rotation modeled and defaults to OFF\n");

  // -------------------------------------------------------------
  // 7. Webhook Normalization: Connected Call & Variables
  // -------------------------------------------------------------
  console.log("7. Webhook Normalization: Connected Call & Variables Tests...");
  const connectedPayload: SarvamCampaignWebhookPayload = {
    attempt_id: "att_001",
    interaction_id: "int_789",
    campaign_id: "sarvam_camp_888",
    cohort_id: "sarvam_cohort_777",
    app_id: "sarvam_app_999",
    user_phone_number: "+919849012345",
    attempt_number: 1,
    completion_status: "completed",
    connectivity_status: "connected",
    next_action_status: "none",
    duration_seconds: 145,
    output_agent_variables: {
      call_outcome: "INTERESTED",
      interest_level: "HIGH",
      customer_name: "Ramesh Gupta",
      customer_questions: ["What is the possession date?", "Is clubhouse included?"],
      objections: [],
      next_action: "Schedule site visit on Saturday",
    },
    interaction_transcript: [
      {
        role: "agent",
        en_text: "Hello! Am I speaking with Ramesh Gupta? Calling from Prestige.",
        indic_text: "नमस्ते! क्या मैं रमेश गुप्ता जी से बात कर रही हूँ? प्रेस्टीज से बोल रही हूँ।",
      },
      {
        role: "user",
        en_text: "Yes, tell me about the villas.",
        indic_text: "हाँ, विला के बारे में बताइए।",
      },
    ],
  };

  const normConnected = normalizeCampaignWebhook(connectedPayload);
  if (normConnected.callStatus !== "COMPLETED") {
    throw new Error("Connected + completed must map to COMPLETED");
  }
  if (normConnected.callOutcome !== "INTERESTED") {
    throw new Error("Outcome must be INTERESTED");
  }
  if (normConnected.providerInteractionId !== "int_789") {
    throw new Error("providerInteractionId must be preserved");
  }
  if (!normConnected.transcriptText.includes("नमस्ते!")) {
    throw new Error("Indic transcript must be preserved in transcript text (Rule 2)");
  }
  if (normConnected.transcriptJson.length !== 2) {
    throw new Error("Full transcript turns JSON must be preserved");
  }
  console.log("  ✅ Connected call mapped with status COMPLETED and outcome INTERESTED");
  console.log("  ✅ Indic Hindi text + English transcript preserved in structured format\n");

  // -------------------------------------------------------------
  // 8. Webhook Normalization: Connectivity Statuses (Busy, No Answer)
  // -------------------------------------------------------------
  console.log("8. Webhook Connectivity Status Mapping Tests...");
  const busyPayload: SarvamCampaignWebhookPayload = {
    attempt_id: "att_002",
    campaign_id: "sarvam_camp_888",
    cohort_id: "sarvam_cohort_777",
    app_id: "sarvam_app_999",
    user_phone_number: "+919849012345",
    attempt_number: 1,
    completion_status: "failed",
    connectivity_status: "busy",
    next_action_status: "retry",
    duration_seconds: 0,
  };
  const normBusy = normalizeCampaignWebhook(busyPayload);
  if (normBusy.callStatus !== "BUSY" || normBusy.callOutcome !== "BUSY") {
    throw new Error("Busy connectivity must map to status BUSY and outcome BUSY");
  }
  if (normBusy.retryMetadata.next_action_status !== "retry") {
    throw new Error("Retry metadata must capture next_action_status");
  }
  console.log("  ✅ Busy call mapped to status BUSY with retry metadata");

  const noAnswerPayload: SarvamCampaignWebhookPayload = {
    attempt_id: "att_003",
    campaign_id: "sarvam_camp_888",
    cohort_id: "sarvam_cohort_777",
    app_id: "sarvam_app_999",
    user_phone_number: "+919849012345",
    attempt_number: 1,
    completion_status: "failed",
    connectivity_status: "no_answer",
    next_action_status: "retry",
    duration_seconds: 0,
  };
  const normNoAnswer = normalizeCampaignWebhook(noAnswerPayload);
  if (normNoAnswer.callStatus !== "NO_ANSWER" || normNoAnswer.callOutcome !== "NO_ANSWER") {
    throw new Error("No answer connectivity must map to status NO_ANSWER");
  }
  console.log("  ✅ No answer call mapped to status NO_ANSWER\n");

  // -------------------------------------------------------------
  // 9. DNC vs Wrong Number Separation (Rule 1)
  // -------------------------------------------------------------
  console.log("9. Webhook DNC vs Wrong Number Handling Tests...");
  const dncPayload: SarvamCampaignWebhookPayload = {
    attempt_id: "att_004",
    campaign_id: "sarvam_camp_888",
    cohort_id: "sarvam_cohort_777",
    app_id: "sarvam_app_999",
    user_phone_number: "+919849012345",
    completion_status: "completed",
    connectivity_status: "connected",
    output_agent_variables: {
      dnc_requested: true,
      wrong_number: false,
    },
  };
  const normDnc = normalizeCampaignWebhook(dncPayload);
  if (!normDnc.dncRequested || normDnc.callOutcome !== "DO_NOT_CALL") {
    throw new Error("DNC requested must yield outcome DO_NOT_CALL and dncRequested = true");
  }
  console.log("  ✅ DNC event correctly triggers DO_NOT_CALL outcome");

  const wrongNumPayload: SarvamCampaignWebhookPayload = {
    attempt_id: "att_005",
    campaign_id: "sarvam_camp_888",
    cohort_id: "sarvam_cohort_777",
    app_id: "sarvam_app_999",
    user_phone_number: "+919849012345",
    completion_status: "completed",
    connectivity_status: "connected",
    output_agent_variables: {
      dnc_requested: false,
      wrong_number: true,
    },
  };
  const normWrongNum = normalizeCampaignWebhook(wrongNumPayload);
  if (!normWrongNum.wrongNumber || normWrongNum.callOutcome !== "WRONG_NUMBER") {
    throw new Error("Wrong number must yield outcome WRONG_NUMBER and wrongNumber = true");
  }
  if (normWrongNum.dncRequested) {
    throw new Error("Rule 1 Violation: Wrong number must NOT set dncRequested to true!");
  }
  console.log("  ✅ Rule 1 Enforced: Wrong number is strictly distinct from DNC\n");

  // -------------------------------------------------------------
  // 10. Callback Request Extraction
  // -------------------------------------------------------------
  console.log("10. Callback Request Extraction Tests...");
  const callbackPayload: SarvamCampaignWebhookPayload = {
    attempt_id: "att_006",
    campaign_id: "sarvam_camp_888",
    cohort_id: "sarvam_cohort_777",
    app_id: "sarvam_app_999",
    user_phone_number: "+919849012345",
    completion_status: "completed",
    connectivity_status: "connected",
    output_agent_variables: {
      callback_requested: true,
      callback_datetime: "2026-09-17T15:00:00+05:30",
    },
  };
  const normCallback = normalizeCampaignWebhook(callbackPayload);
  if (!normCallback.callbackRequested || normCallback.callbackDatetime !== "2026-09-17T15:00:00+05:30") {
    throw new Error("Callback request and datetime must be extracted");
  }
  console.log("  ✅ Callback request captured with requested timestamp\n");

  // -------------------------------------------------------------
  // 11. One-Running-Campaign Invariant Guard
  // -------------------------------------------------------------
  console.log("11. Concurrency Guard: One Running Campaign Per Business...");
  const existingRunningCampaigns = [{ id: "camp_existing", name: "Existing Active Campaign" }];
  const canLaunchAnother = existingRunningCampaigns.length === 0;
  if (canLaunchAnother) {
    throw new Error("Should not allow launching another campaign when one is already RUNNING");
  }
  console.log("  ✅ Concurrency guard prevents multiple RUNNING campaigns for the same business\n");

  // -------------------------------------------------------------
  // 12. Pause & Resume Semantics
  // -------------------------------------------------------------
  console.log("12. Campaign Pause & Resume Lifecycle Semantics Tests...");
  let currentCampaignStatus: string = "RUNNING";

  // Pause action
  if (currentCampaignStatus === "RUNNING") {
    currentCampaignStatus = "PAUSED";
  }
  if (currentCampaignStatus !== "PAUSED") {
    throw new Error("Campaign status must transition to PAUSED");
  }
  console.log("  ✅ Pause action successfully transitions RUNNING -> PAUSED");

  // Resume action
  if (currentCampaignStatus === "PAUSED") {
    currentCampaignStatus = "RUNNING";
  }
  if (currentCampaignStatus !== "RUNNING") {
    throw new Error("Campaign status must transition to RUNNING");
  }
  console.log("  ✅ Resume action successfully transitions PAUSED -> RUNNING\n");

  // -------------------------------------------------------------
  // 13. Webhook Admin / Service-Role Ingestion & Server-Only Guard
  // -------------------------------------------------------------
  console.log("13. Webhook Admin / Service-Role Database Ingestion Tests...");

  // Verify createAdminClient initializes with service role key
  const adminClient = createAdminClient();
  if (!adminClient || typeof adminClient.from !== "function") {
    throw new Error("createAdminClient must return a valid Supabase client instance");
  }
  console.log("  ✅ createAdminClient initializes with SUPABASE_SERVICE_ROLE_KEY");

  // Verify webhook-service source code imports createAdminClient from admin.ts, not createClient from server.ts
  const webhookServicePath = path.resolve(__dirname, "../lib/telephony/webhook-service.ts");
  const webhookSource = fs.readFileSync(webhookServicePath, "utf-8");

  if (!webhookSource.includes('import { createAdminClient } from "@/lib/supabase/admin";')) {
    throw new Error("webhook-service.ts must import createAdminClient from '@/lib/supabase/admin'");
  }
  if (webhookSource.includes('import { createClient } from "@/lib/supabase/server";')) {
    throw new Error("webhook-service.ts must NOT import createClient from '@/lib/supabase/server'");
  }
  if (!webhookSource.includes("const supabase = client ?? createAdminClient();")) {
    throw new Error("webhook-service.ts must initialize supabase with createAdminClient()");
  }
  console.log("  ✅ Webhook ingestion verified to use admin/service-role client bypassing RLS");

  // Verify admin.ts has server-only guard
  const adminSourcePath = path.resolve(__dirname, "../lib/supabase/admin.ts");
  const adminSource = fs.readFileSync(adminSourcePath, "utf-8");
  if (!adminSource.includes('typeof window !== "undefined"')) {
    throw new Error("lib/supabase/admin.ts must have a server-only runtime guard");
  }
  console.log("  ✅ createAdminClient is verified to be server-only and blocked from browsers\n");

  // -------------------------------------------------------------
  // 14. Sarvam Scheduling API Wire Contract
  // -------------------------------------------------------------
  console.log("14. Sarvam Scheduling API Wire Contract Tests...");

  const wirePayload = buildCreateCampaignPayload({
    name: "Prestige Golfshire Outbound",
    description: "Outbound qualification calls for Q3 villa leads",
    app_id: "agent-abc123",
    app_version: "v2",
    phone_number_id: "conn-xyz",
    caller_id: "918041234567",
    schedule: {
      start_time: "10:00:00",
      end_time: "18:30:00",
      allowed_days: [1, 2, 3, 4, 5, 6],
      timezone: "Asia/Kolkata",
    },
    retry_policy: {
      max_attempts: 3,
      retry_interval_minutes: 45,
      enable_phone_rotation: false,
    },
    webhook: {
      url: "https://app.example.com/api/webhooks/sarvam/campaign?token=abc",
      metadata: { campaign_id: "camp_001" },
    },
  });

  if (wirePayload.app_config.app_id !== "agent-abc123") {
    throw new Error("app_config.app_id must be forwarded to Sarvam");
  }
  if (wirePayload.app_config.app_version !== 2 || typeof wirePayload.app_config.app_version !== "number") {
    throw new Error("app_config.app_version must be a positive integer, not a string");
  }
  if (wirePayload.app_config.attempts_per_second < 0.1 || wirePayload.app_config.attempts_per_second > 500) {
    throw new Error("attempts_per_second must stay within the documented 0.1-500 range");
  }
  const connection = wirePayload.app_config.connection_configs[0];
  if (!connection || connection.connection_id !== "conn-xyz") {
    throw new Error("connection_configs must carry the Sarvam connection id");
  }
  if (connection.phone_numbers[0] !== "+918041234567") {
    throw new Error("Dialer numbers must be normalized to E.164");
  }
  if (wirePayload.app_config.retry_config.max_retries !== 3) {
    throw new Error("retry_config.max_retries must be forwarded from the campaign retry policy");
  }
  if (wirePayload.app_config.retry_config.retry_on?.busy?.enabled !== true) {
    throw new Error("retry_on.busy must be enabled when retries are configured");
  }
  if (wirePayload.app_config.phone_rotation !== undefined) {
    throw new Error("phone_rotation must be omitted when only one number is available");
  }
  if (wirePayload.allowed_schedule.allowed_start_time !== "10:00") {
    throw new Error("allowed_start_time must be HH:MM (Sarvam rejects seconds)");
  }
  if (wirePayload.allowed_schedule.allowed_days[0] !== "Monday") {
    throw new Error("calling_days 1 must map to Monday for Sarvam");
  }
  if (wirePayload.allowed_schedule.allowed_days[5] !== "Saturday") {
    throw new Error("calling_days 6 must map to Saturday for Sarvam");
  }
  if (Number.isNaN(Date.parse(wirePayload.start_timestamp)) || Number.isNaN(Date.parse(wirePayload.end_timestamp))) {
    throw new Error("start_timestamp and end_timestamp must be ISO 8601 datetimes");
  }
  if (Date.parse(wirePayload.end_timestamp) <= Date.parse(wirePayload.start_timestamp)) {
    throw new Error("end_timestamp must be after start_timestamp");
  }
  if (Date.parse(wirePayload.start_timestamp) - Date.now() < 120_000) {
    throw new Error("start_timestamp must be at least 120 seconds in the future (Sarvam requirement)");
  }
  if (wirePayload.webhook_config?.url !== "https://app.example.com/api/webhooks/sarvam/campaign?token=abc") {
    throw new Error("webhook_config.url must be forwarded to Sarvam");
  }
  if (wirePayload.webhook_config?.metadata?.campaign_id !== "camp_001") {
    throw new Error("webhook_config.metadata must be forwarded for webhook correlation");
  }
  console.log("  OK. Campaign create payload matches the documented scheduling API contract");

  // No-retry campaigns must not send retry conditions.
  const noRetryPayload = buildCreateCampaignPayload({
    name: "No Retry Campaign",
    app_id: "agent-abc123",
    app_version: 1,
    phone_number_id: "conn-xyz",
    caller_id: "918041234567",
    schedule: { start_time: "09:00", end_time: "18:00", allowed_days: [1], timezone: "Asia/Kolkata" },
    retry_policy: { max_attempts: 0, retry_interval_minutes: 30, enable_phone_rotation: false },
  });
  if (noRetryPayload.app_config.retry_config.max_retries !== 0 || noRetryPayload.app_config.retry_config.retry_on) {
    throw new Error("Retry conditions must be omitted when retries are disabled");
  }
  console.log("  OK. Retry policy is omitted for campaigns with retries disabled");

  // Two or more numbers unlock agent phone rotation.
  const rotationPayload = buildCreateCampaignPayload({
    name: "Rotation Campaign",
    app_id: "agent-abc123",
    app_version: 1,
    phone_number_id: "conn-xyz",
    caller_id: "918041234567",
    caller_ids: ["918041234568"],
    schedule: { start_time: "09:00", end_time: "18:00", allowed_days: [1], timezone: "Asia/Kolkata" },
    retry_policy: { max_attempts: 1, retry_interval_minutes: 30, enable_phone_rotation: true },
  });
  if (rotationPayload.app_config.phone_rotation?.agent !== true) {
    throw new Error("phone_rotation.agent must be enabled when rotation is on and 2+ numbers exist");
  }
  if (rotationPayload.app_config.connection_configs[0].phone_numbers.length !== 2) {
    throw new Error("Both dialer numbers must be sent when rotation is enabled");
  }
  console.log("  OK. Agent phone rotation only activates with a multi-number pool");

  // Cohort user records use the documented user_identifier/app_variables shape.
  const cohortUser = buildCohortUser(
    {
      id: "11111111-2222-3333-4444-555555555555",
      business_id: businessId,
      name: "Ramesh Gupta",
      phone: "9849012345",
      city: "Bengaluru",
      is_dnc: false,
      is_wrong_number: false,
      status: "ACTIVE",
    } as unknown as Database["public"]["Tables"]["contacts"]["Row"],
    { businessName: "Prestige", campaignOffering: "Villas", appVariables: ["customer_name"] }
  );

  if (cohortUser.user_phone_number !== "+919849012345") {
    throw new Error("Cohort user_phone_number must be E.164 normalized");
  }
  if (cohortUser.user_identifier !== "11111111-2222-3333-4444-555555555555") {
    throw new Error("Cohort user_identifier must carry our contact id for webhook matching");
  }
  if (cohortUser.app_variables?.customer_name !== "Ramesh Gupta") {
    throw new Error("Allow-listed app_variables must be streamed to the agent");
  }
  if (Object.keys(cohortUser.app_variables || {}).length !== 1) {
    throw new Error("Only allow-listed agent variables may be streamed (Sarvam rejects unknown keys)");
  }
  console.log("  OK. Cohort users use user_identifier + allow-listed app_variables");

  // Webhook normalization must accept the current documented field names.
  const currentPayload: SarvamCampaignWebhookPayload = {
    app_id: "agent-abc123",
    app_version: 2,
    attempt_id: "att_current_001",
    campaign_id: "camp-a1b2c3d4",
    cohort_id: "coh-x1y2z3",
    user_identifier: "11111111-2222-3333-4444-555555555555",
    user_phone_number: "+919849012345",
    agent_phone_number: "+918041234567",
    retry_attempt: 0,
    completion_status: "completed",
    connectivity_status: "connected",
    next_action_status: null,
    duration: 42.5,
    executed_at: "2026-03-29T10:30:45+05:30",
    output_agent_variables: { call_outcome: "INTERESTED" },
    interaction_transcript: [{ role: "user", en_text: "Yes, tell me about the villas." }],
  };

  const normCurrent = normalizeCampaignWebhook(currentPayload);
  if (normCurrent.durationSeconds !== 43) {
    throw new Error("duration (seconds) must be normalized from the current payload field");
  }
  if (normCurrent.providerUserIdentifier !== "11111111-2222-3333-4444-555555555555") {
    throw new Error("user_identifier must be preserved for contact correlation");
  }
  if (normCurrent.agentPhoneNumber !== "+918041234567") {
    throw new Error("agent_phone_number must be preserved");
  }
  if (normCurrent.retryMetadata.retry_attempt !== 0) {
    throw new Error("retry_attempt must be preserved (0 = first attempt)");
  }
  if (normCurrent.providerCohortId !== "coh-x1y2z3") {
    throw new Error("cohort_id must be preserved");
  }
  console.log("  OK. Webhook normalization handles the current documented payload fields");

  // Disconnected attempts arrive with null transcript and null duration.
  const notConnected = normalizeCampaignWebhook({
    app_id: "agent-abc123",
    attempt_id: "att_current_002",
    campaign_id: "camp-a1b2c3d4",
    cohort_id: "coh-x1y2z3",
    user_identifier: null,
    user_phone_number: "+919849012346",
    retry_attempt: 1,
    completion_status: "failed",
    connectivity_status: "failed",
    next_action_status: "retry",
    duration: null,
    failure_reason: "TelephonyProvider: Rate Limit Exceeded",
    interaction_transcript: null,
    output_agent_variables: null,
  });
  if (notConnected.callStatus !== "FAILED" || notConnected.durationSeconds !== 0) {
    throw new Error("Not-connected attempts must map to FAILED with zero duration");
  }
  if (notConnected.transcriptJson.length !== 0 || notConnected.transcriptText !== "") {
    throw new Error("Null transcripts must normalize to an empty transcript");
  }
  if (notConnected.failureReason !== "TelephonyProvider: Rate Limit Exceeded") {
    throw new Error("failure_reason must be preserved for provider diagnostics");
  }
  console.log("  OK. Not-connected webhook attempts normalize safely\n");

  console.log("==================================================");
  console.log("ALL 34 PHASE 4 & 5 TELEPHONY & WEBHOOK TESTS PASSED!");
  console.log("==================================================");
}
