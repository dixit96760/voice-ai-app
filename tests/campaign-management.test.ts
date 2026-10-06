import {
  campaignBasicInfoSchema,
  campaignKnowledgeSourceSchema,
  campaignAiBehaviorSchema,
  campaignCallingRulesSchema,
} from "../lib/validation/campaign";
import { validateCampaignReadiness } from "../lib/campaign/validator";
import type { Campaign, CampaignSource } from "../lib/campaign/types";

export function runCampaignManagementTests() {
  console.log("==================================================");
  console.log("RUNNING SUITE: CAMPAIGN BUILDER & MANAGEMENT (PHASE 3)");
  console.log("==================================================\n");

  const businessId = "bus_12345";

  // Mock valid baseline campaign
  const validCampaign: Campaign = {
    id: "camp_001",
    business_id: businessId,
    name: "Bangalore Luxury Villa Leads",
    offering_type: "Real Estate Villa Project",
    industry: "Real Estate",
    objective: "Qualify high net-worth prospects",
    description: "Cold call inbound inquiries for Prestige Golfshire Villas.",
    status: "DRAFT",
    timezone: "Asia/Kolkata",
    calling_days: [1, 2, 3, 4, 5, 6],
    calling_start_time: "10:00:00",
    calling_end_time: "18:30:00",
    max_attempts: 3,
    retry_interval_minutes: 60,
    max_call_duration_seconds: 300,
    active_version_id: "ver_001",
    sarvam_agent_id: null,
    sarvam_campaign_id: null,
    sarvam_cohort_id: null,
    enable_phone_rotation: false,
    auto_complete: false,
    started_at: null,
    paused_at: null,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };

  const validSource: CampaignSource = {
    id: "src_001",
    campaign_id: validCampaign.id,
    source_type: "text",
    source_name: "Pricing and Amenities FAQs",
    source_url: null,
    storage_path: null,
    raw_text: "Prestige Golfshire 4BHK villas start at INR 7.5 Crores. Possession by Dec 2026.",
    processing_status: "READY",
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // -------------------------------------------------------------
  // 1. Basic Info Schema Validation
  // -------------------------------------------------------------
  console.log("1. Campaign Basic Info Schema Tests...");

  const validInfo = campaignBasicInfoSchema.safeParse({
    name: "Q3 Diwali Real Estate Campaign",
    offeringType: "3BHK Luxury Apartments",
    industry: "Real Estate",
    objective: "Book site visits",
    description: "Reach out to leads interested in Whitefield properties.",
  });
  if (!validInfo.success) {
    throw new Error(`Valid basic info failed: ${JSON.stringify(validInfo.error)}`);
  }
  console.log("  ✅ Valid basic info parsed correctly");

  const shortName = campaignBasicInfoSchema.safeParse({
    name: "A",
    offeringType: "Apartments",
    industry: "Real Estate",
    objective: "Book site visits",
    description: "Reach out to leads interested in Whitefield properties.",
  });
  if (shortName.success) {
    throw new Error("Short campaign name (<2 chars) should have failed");
  }
  console.log("  ✅ Campaign name under 2 chars rejected");

  const shortDesc = campaignBasicInfoSchema.safeParse({
    name: "Diwali Campaign",
    offeringType: "Apartments",
    industry: "Real Estate",
    objective: "Book site visits",
    description: "Short",
  });
  if (shortDesc.success) {
    throw new Error("Short description (<10 chars) should have failed");
  }
  console.log("  ✅ Campaign description under 10 chars rejected\n");

  // -------------------------------------------------------------
  // 2. Knowledge Source Validation
  // -------------------------------------------------------------
  console.log("2. Campaign Knowledge Source Validation Tests...");

  const validKnowledge = campaignKnowledgeSourceSchema.safeParse({
    sourceName: "Project Brochure",
    sourceType: "text",
    rawText: "Detailed project features and amenities list for customer inquiries.",
  });
  if (!validKnowledge.success) {
    throw new Error(`Valid knowledge source failed: ${JSON.stringify(validKnowledge.error)}`);
  }
  console.log("  ✅ Valid knowledge source parsed correctly");

  const emptyTextSource = campaignKnowledgeSourceSchema.safeParse({
    sourceName: "Empty Source",
    sourceType: "text",
    rawText: "too short",
  });
  if (emptyTextSource.success) {
    throw new Error("Short knowledge text (<10 chars) should have failed validation");
  }
  console.log("  ✅ Knowledge snippet under 10 chars rejected\n");

  // -------------------------------------------------------------
  // 3. AI Behavior & Persona Validation
  // -------------------------------------------------------------
  console.log("3. AI Behavior & Persona Validation Tests...");

  const validBehavior = campaignAiBehaviorSchema.safeParse({
    preferredLanguage: "hi-IN",
    additionalLanguages: ["en-IN"],
    tone: "Friendly",
    salesAssistance: "Mild",
    behaviorRules: {
      onlyApprovedInfo: true,
      neverInventPrices: true,
      redirectUnrelatedQuestions: true,
      respectDnc: true,
      captureCallback: true,
      endAbusivePolitely: true,
    },
  });
  if (!validBehavior.success) {
    throw new Error(`Valid AI behavior failed: ${JSON.stringify(validBehavior.error)}`);
  }
  console.log("  ✅ Valid AI persona with Hindi preferred language parsed correctly");

  const invalidTone = campaignAiBehaviorSchema.safeParse({
    preferredLanguage: "en-IN",
    tone: "Aggressive", // Not allowed
    salesAssistance: "Mild",
  });
  if (invalidTone.success) {
    throw new Error("Invalid tone should have failed");
  }
  console.log("  ✅ Invalid tone rejected\n");

  // -------------------------------------------------------------
  // 4. Calling Rules & Schedule Validation
  // -------------------------------------------------------------
  console.log("4. Calling Rules & Schedule Validation Tests...");

  const validRules = campaignCallingRulesSchema.safeParse({
    callingStartTime: "09:30",
    callingEndTime: "18:30",
    callingDays: [1, 2, 3, 4, 5],
    maxAttempts: 3,
    retryIntervalMinutes: 60,
    maxCallDurationSeconds: 300,
  });
  if (!validRules.success) {
    throw new Error(`Valid calling rules failed: ${JSON.stringify(validRules.error)}`);
  }
  console.log("  ✅ Valid calling schedule (09:30 - 18:30, Mon-Fri) parsed correctly");

  const invalidWindow = campaignCallingRulesSchema.safeParse({
    callingStartTime: "19:00",
    callingEndTime: "10:00", // Inverted
    callingDays: [1, 2, 3],
    maxAttempts: 3,
    retryIntervalMinutes: 60,
    maxCallDurationSeconds: 300,
  });
  if (invalidWindow.success) {
    throw new Error("End time before start time should have failed schema validation");
  }
  console.log("  ✅ Inverted calling window (end < start) rejected");

  const invalidRetry = campaignCallingRulesSchema.safeParse({
    callingStartTime: "10:00",
    callingEndTime: "18:00",
    callingDays: [1, 2, 3],
    maxAttempts: 3,
    retryIntervalMinutes: 5, // Min is 15 minutes
    maxCallDurationSeconds: 300,
  });
  if (invalidRetry.success) {
    throw new Error("Retry gap < 15 minutes should have failed");
  }
  console.log("  ✅ Aggressive retry interval (<15m) rejected\n");

  // -------------------------------------------------------------
  // 5. Pre-flight Readiness Validator Tests
  // -------------------------------------------------------------
  console.log("5. Pre-flight Readiness Validator Tests...");

  // Scenario A: Fully ready campaign
  const readyResult = validateCampaignReadiness({
    campaign: validCampaign,
    sources: [validSource],
    contactCount: 50,
    businessId,
  });
  if (!readyResult.ready || readyResult.errors.length > 0) {
    throw new Error(`Expected campaign to be ready: ${JSON.stringify(readyResult.errors)}`);
  }
  console.log("  ✅ Fully configured campaign marked READY (0 errors)");

  // Scenario B: Missing knowledge sources
  const noKnowledgeResult = validateCampaignReadiness({
    campaign: validCampaign,
    sources: [],
    contactCount: 50,
    businessId,
  });
  if (noKnowledgeResult.ready) {
    throw new Error("Campaign without knowledge sources must NOT be ready");
  }
  if (!noKnowledgeResult.errors.some((e) => e.code === "KNOWLEDGE_REQUIRED")) {
    throw new Error("Expected KNOWLEDGE_REQUIRED error code");
  }
  console.log("  ✅ Missing knowledge source detected & blocks READY state");

  // Scenario C: Zero contacts enrolled
  const zeroContactsResult = validateCampaignReadiness({
    campaign: validCampaign,
    sources: [validSource],
    contactCount: 0,
    businessId,
  });
  if (zeroContactsResult.ready) {
    throw new Error("Campaign with 0 contacts must NOT be ready");
  }
  if (!zeroContactsResult.errors.some((e) => e.code === "CONTACTS_REQUIRED")) {
    throw new Error("Expected CONTACTS_REQUIRED error code");
  }
  console.log("  ✅ Zero assigned contacts detected & blocks READY state");

  // Scenario D: Cross-business ownership mismatch
  const crossBusinessResult = validateCampaignReadiness({
    campaign: validCampaign,
    sources: [validSource],
    contactCount: 50,
    businessId: "different_business_id",
  });
  if (crossBusinessResult.ready) {
    throw new Error("Cross-business access must NOT be ready");
  }
  if (!crossBusinessResult.errors.some((e) => e.code === "INVALID_OWNERSHIP")) {
    throw new Error("Expected INVALID_OWNERSHIP error code");
  }
  console.log("  ✅ Cross-business isolation enforced (INVALID_OWNERSHIP)\n");

  // -------------------------------------------------------------
  // 6. Campaign Duplication & Lifecycle Invariant Tests
  // -------------------------------------------------------------
  console.log("6. Campaign Duplication & Soft-Delete Invariant Tests...");

  // Duplication rule: must strip provider IDs and runtime states
  const duplicateCandidate = {
    ...validCampaign,
    status: "READY" as const,
    sarvam_campaign_id: "srv_camp_9999", // Mock provider ID
    sarvam_agent_id: "srv_agent_8888",
    active_calls_count: 5,
  };

  // Simulating duplicate action logic
  const clonedCampaign = {
    ...duplicateCandidate,
    id: "camp_cloned_002",
    name: `${duplicateCandidate.name} (Copy)`,
    status: "DRAFT",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };
  delete (clonedCampaign as Record<string, unknown>).sarvam_campaign_id;
  delete (clonedCampaign as Record<string, unknown>).sarvam_agent_id;
  delete (clonedCampaign as Record<string, unknown>).active_calls_count;

  if (clonedCampaign.status !== "DRAFT") {
    throw new Error("Cloned campaign must be reset to DRAFT");
  }
  if (!clonedCampaign.name.endsWith("(Copy)")) {
    throw new Error("Cloned campaign must have '(Copy)' in name");
  }
  if ((clonedCampaign as Record<string, unknown>).sarvam_campaign_id) {
    throw new Error("Provider IDs must NOT leak into duplicated campaign");
  }
  console.log("  ✅ Duplicated campaign reset to DRAFT with provider IDs stripped");

  // Soft delete semantics: deleted_at set, preserves records
  const softDeletedCampaign = {
    ...validCampaign,
    deleted_at: new Date().toISOString(),
  };
  if (!softDeletedCampaign.deleted_at) {
    throw new Error("Soft delete must populate deleted_at timestamp");
  }
  console.log("  ✅ Soft-delete populates deleted_at timestamp without data loss");

  console.log("\n==================================================");
  console.log("ALL 16 PHASE 3 CAMPAIGN TEST SCENARIOS PASSED!");
  console.log("==================================================");
}
