"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/auth/session";
import {
  campaignBasicInfoSchema,
  campaignKnowledgeSourceSchema,
  campaignAiBehaviorSchema,
  campaignCallingRulesSchema,
  CampaignReadinessResult,
  CAMPAIGN_TIMEZONE,
} from "@/lib/validation/campaign";
import { validateCampaignReadiness } from "./validator";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Campaign, CampaignSource } from "./types";
import type { Json } from "@/lib/supabase/types";
import { launchCampaignExecution } from "@/lib/telephony/launch-service";
import { SarvamVoiceProvider } from "@/lib/providers/sarvam";
import { quotaService } from "@/lib/billing/quota-service";

export interface CampaignActionResult<T = Record<string, unknown>> {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  message?: string;
  data?: T;
}

/**
 * 1. Create a new campaign draft (Step 1)
 */
export async function createCampaignDraftAction(
  prevState: CampaignActionResult | null,
  formData: FormData
): Promise<CampaignActionResult<{ campaignId: string }>> {
  const { user, business } = await requireBusiness();

  const rawData = {
    name: formData.get("name") as string,
    offeringType: formData.get("offeringType") as string,
    industry: (formData.get("industry") as string) || "Real Estate",
    objective: (formData.get("objective") as string) || "Qualify prospects",
    description: formData.get("description") as string,
  };

  const validation = campaignBasicInfoSchema.safeParse(rawData);
  if (!validation.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of validation.error.issues) {
      fieldErrors[issue.path[0] as string] = issue.message;
    }
    return {
      error: "Please correct the highlighted fields.",
      fieldErrors,
    };
  }

  const supabase = await createClient();

  // Insert new campaign in DRAFT status
  const { data: campaign, error: insertError } = await supabase
    .from("campaigns")
    .insert({
      business_id: business.id,
      name: validation.data.name,
      offering_type: validation.data.offeringType,
      industry: validation.data.industry,
      objective: validation.data.objective,
      description: validation.data.description,
      status: "DRAFT",
      timezone: CAMPAIGN_TIMEZONE,
      calling_days: [1, 2, 3, 4, 5, 6],
      calling_start_time: "10:00:00",
      calling_end_time: "18:30:00",
      max_attempts: 3,
      retry_interval_minutes: 60,
      max_call_duration_seconds: 300,
    })
    .select("*")
    .single();

  if (insertError || !campaign) {
    console.error("Failed to create campaign draft:", insertError);
    return { error: "Failed to create campaign. Please try again." };
  }

  // Create initial campaign version
  const { data: initialVersion } = await supabase
    .from("campaign_versions")
    .insert({
      campaign_id: campaign.id,
      version_number: 1,
      system_instructions: `Campaign for ${campaign.offering_type}: ${campaign.description}`,
      knowledge_snapshot: {},
      configuration: {
        language: "en-IN",
        additionalLanguages: [],
        tone: "Friendly",
        salesAssistance: "Mild",
      },
      status: "DRAFT",
    })
    .select("id")
    .single();

  if (initialVersion) {
    await supabase
      .from("campaigns")
      .update({ active_version_id: initialVersion.id })
      .eq("id", campaign.id);
  }

  // Record audit log
  await supabase.from("audit_logs").insert({
    business_id: business.id,
    user_id: user.id,
    action: "CAMPAIGN_CREATED",
    entity_type: "campaign",
    entity_id: campaign.id,
    new_values: { name: campaign.name, offering: campaign.offering_type },
  });

  redirect(`/campaigns/${campaign.id}/edit?step=2`);
}

/**
 * 2. Update basic info of an existing campaign
 */
export async function updateCampaignBasicInfoAction(
  campaignId: string,
  prevState: CampaignActionResult | null,
  formData: FormData
): Promise<CampaignActionResult> {
  const { user, business } = await requireBusiness();

  const rawData = {
    name: formData.get("name") as string,
    offeringType: formData.get("offeringType") as string,
    industry: (formData.get("industry") as string) || "Real Estate",
    objective: (formData.get("objective") as string) || "Qualify prospects",
    description: formData.get("description") as string,
  };

  const validation = campaignBasicInfoSchema.safeParse(rawData);
  if (!validation.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of validation.error.issues) {
      fieldErrors[issue.path[0] as string] = issue.message;
    }
    return { error: "Validation failed", fieldErrors };
  }

  const supabase = await createClient();

  const { error: updateError } = await supabase
    .from("campaigns")
    .update({
      name: validation.data.name,
      offering_type: validation.data.offeringType,
      industry: validation.data.industry,
      objective: validation.data.objective,
      description: validation.data.description,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
    .eq("business_id", business.id)
    .is("deleted_at", null);

  if (updateError) {
    return { error: "Failed to update campaign details." };
  }

  await supabase.from("audit_logs").insert({
    business_id: business.id,
    user_id: user.id,
    action: "CAMPAIGN_UPDATED",
    entity_type: "campaign",
    entity_id: campaignId,
    new_values: validation.data,
  });

  revalidatePath(`/campaigns/${campaignId}`);
  return { success: true, message: "Basic information saved." };
}

/**
 * 3. Add Knowledge Source
 */
export async function addKnowledgeSourceAction(
  campaignId: string,
  prevState: CampaignActionResult | null,
  formData: FormData
): Promise<CampaignActionResult> {
  const { business } = await requireBusiness();

  const rawData = {
    sourceType: formData.get("sourceType") as string,
    sourceName: formData.get("sourceName") as string,
    rawText: (formData.get("rawText") as string) || "",
    sourceUrl: (formData.get("sourceUrl") as string) || "",
  };

  const validation = campaignKnowledgeSourceSchema.safeParse(rawData);
  if (!validation.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of validation.error.issues) {
      fieldErrors[issue.path[0] as string] = issue.message;
    }
    return { error: "Invalid knowledge source input.", fieldErrors };
  }

  const supabase = await createClient();

  // Verify campaign belongs to business
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("business_id", business.id)
    .single();

  if (!campaign) {
    return { error: "Unauthorized or campaign not found." };
  }

  const isUsable =
    validation.data.sourceType === "manual" &&
    Boolean(validation.data.rawText && validation.data.rawText.trim().length >= 10);

  const { error: insertError } = await supabase.from("campaign_sources").insert({
    campaign_id: campaignId,
    source_type: validation.data.sourceType,
    source_name: validation.data.sourceName,
    raw_text: validation.data.rawText || null,
    source_url: validation.data.sourceUrl || null,
    processing_status: isUsable ? "READY" : "PENDING",
  });

  if (insertError) {
    return { error: "Failed to add knowledge source." };
  }

  revalidatePath(`/campaigns/${campaignId}/edit`);
  return { success: true, message: "Knowledge source added successfully." };
}

/**
 * 4. Remove Knowledge Source
 */
export async function removeKnowledgeSourceAction(
  campaignId: string,
  sourceId: string
): Promise<CampaignActionResult> {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  // Verify ownership
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("business_id", business.id)
    .single();

  if (!campaign) {
    return { error: "Unauthorized or campaign not found." };
  }

  const { error } = await supabase
    .from("campaign_sources")
    .delete()
    .eq("id", sourceId)
    .eq("campaign_id", campaignId);

  if (error) {
    return { error: "Failed to delete knowledge source." };
  }

  revalidatePath(`/campaigns/${campaignId}/edit`);
  return { success: true, message: "Knowledge source removed." };
}

/**
 * 5. Update AI Behavior (Step 3)
 */
export async function updateAiBehaviorAction(
  campaignId: string,
  prevState: CampaignActionResult | null,
  formData: FormData
): Promise<CampaignActionResult> {
  const { business } = await requireBusiness();

  const rawData = {
    preferredLanguage: (formData.get("preferredLanguage") as string) || "en-IN",
    additionalLanguages: formData.getAll("additionalLanguages") as string[],
    tone: (formData.get("tone") as string) || "Friendly",
    salesAssistance: (formData.get("salesAssistance") as string) || "Mild",
    behaviorRules: {
      onlyApprovedInfo: formData.get("onlyApprovedInfo") === "on",
      neverInventPrices: formData.get("neverInventPrices") === "on",
      redirectUnrelatedQuestions: formData.get("redirectUnrelatedQuestions") === "on",
      respectDnc: formData.get("respectDnc") === "on",
      captureCallback: formData.get("captureCallback") === "on",
      endAbusivePolitely: formData.get("endAbusivePolitely") === "on",
    },
  };

  const validation = campaignAiBehaviorSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: "Invalid AI behavior parameters." };
  }

  const supabase = await createClient();

  // Verify campaign ownership
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, active_version_id")
    .eq("id", campaignId)
    .eq("business_id", business.id)
    .single();

  if (!campaign) {
    return { error: "Campaign not found or unauthorized." };
  }

  if (campaign.active_version_id) {
    await supabase
      .from("campaign_versions")
      .update({
        configuration: validation.data as unknown as Json,
      })
      .eq("id", campaign.active_version_id);
  }

  revalidatePath(`/campaigns/${campaignId}/edit`);
  return { success: true, message: "AI Behavior settings saved." };
}

/**
 * 6. Assign Contacts to Campaign (Step 4)
 */
export async function assignContactsToCampaignAction(
  campaignId: string,
  contactIds: string[]
): Promise<CampaignActionResult> {
  const { business } = await requireBusiness();
  if (contactIds.length === 0) {
    return { error: "No contacts selected." };
  }

  const supabase = await createClient();

  // Verify campaign belongs to business
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("business_id", business.id)
    .single();

  if (!campaign) {
    return { error: "Campaign not found or unauthorized." };
  }

  // Verify all contactIds belong to the current business
  const { data: validContacts } = await supabase
    .from("contacts")
    .select("id")
    .eq("business_id", business.id)
    .in("id", contactIds);

  const validIds = (validContacts || []).map((c) => c.id);
  if (validIds.length === 0) {
    return { error: "No valid contacts found belonging to your business." };
  }

  const records = validIds.map((cId) => ({
    campaign_id: campaignId,
    contact_id: cId,
    status: "QUEUED",
    attempt_count: 0,
  }));

  const { error } = await supabase
    .from("campaign_contacts")
    .upsert(records, { onConflict: "campaign_id,contact_id", ignoreDuplicates: true });

  if (error) {
    return { error: "Failed to assign contacts." };
  }

  revalidatePath(`/campaigns/${campaignId}/edit`);
  return { success: true, message: `${validIds.length} contact(s) assigned.` };
}

/**
 * 7. Remove Contact from Campaign
 */
export async function removeContactFromCampaignAction(
  campaignId: string,
  contactId: string
): Promise<CampaignActionResult> {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  // Verify campaign ownership
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("business_id", business.id)
    .single();

  if (!campaign) {
    return { error: "Unauthorized." };
  }

  const { error } = await supabase
    .from("campaign_contacts")
    .delete()
    .eq("campaign_id", campaignId)
    .eq("contact_id", contactId);

  if (error) {
    return { error: "Failed to remove contact." };
  }

  revalidatePath(`/campaigns/${campaignId}/edit`);
  return { success: true, message: "Contact removed from campaign." };
}

/**
 * 8. Update Calling Rules (Step 5)
 */
export async function updateCallingRulesAction(
  campaignId: string,
  prevState: CampaignActionResult | null,
  formData: FormData
): Promise<CampaignActionResult> {
  const { business } = await requireBusiness();

  const callingDaysRaw = formData.getAll("callingDays").map(Number);
  const rawData = {
    callingDays: callingDaysRaw.length > 0 ? callingDaysRaw : [1, 2, 3, 4, 5, 6],
    callingStartTime: (formData.get("callingStartTime") as string) || "10:00",
    callingEndTime: (formData.get("callingEndTime") as string) || "18:30",
    timezone: CAMPAIGN_TIMEZONE,
    maxAttempts: Number(formData.get("maxAttempts")) || 3,
    retryIntervalMinutes: Number(formData.get("retryIntervalMinutes")) || 60,
    maxCallDurationSeconds: Number(formData.get("maxCallDurationSeconds")) || 300,
  };

  const validation = campaignCallingRulesSchema.safeParse(rawData);
  if (!validation.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of validation.error.issues) {
      fieldErrors[issue.path[0] as string] = issue.message;
    }
    return { error: "Invalid calling rules.", fieldErrors };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("campaigns")
    .update({
      calling_days: validation.data.callingDays,
      calling_start_time: `${validation.data.callingStartTime}:00`,
      calling_end_time: `${validation.data.callingEndTime}:00`,
      timezone: validation.data.timezone,
      max_attempts: validation.data.maxAttempts,
      retry_interval_minutes: validation.data.retryIntervalMinutes,
      max_call_duration_seconds: validation.data.maxCallDurationSeconds,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
    .eq("business_id", business.id)
    .is("deleted_at", null);

  if (error) {
    return { error: "Failed to update calling rules." };
  }

  revalidatePath(`/campaigns/${campaignId}/edit`);
  return { success: true, message: "Calling rules updated." };
}

/**
 * 9. Validate and Mark Ready (Step 6)
 */
export async function validateAndMarkReadyAction(
  campaignId: string
): Promise<CampaignActionResult<CampaignReadinessResult>> {
  const { user, business } = await requireBusiness();
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("business_id", business.id)
    .is("deleted_at", null)
    .single();

  if (!campaign) {
    return { error: "Campaign not found or unauthorized." };
  }

  const { data: sources } = await supabase
    .from("campaign_sources")
    .select("*")
    .eq("campaign_id", campaignId);

  const { count: contactCount } = await supabase
    .from("campaign_contacts")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  const readiness = validateCampaignReadiness({
    campaign: campaign as Campaign,
    sources: (sources || []) as CampaignSource[],
    contactCount: contactCount || 0,
    businessId: business.id,
  });

  if (!readiness.ready) {
    return {
      error: "Campaign is not ready. Please resolve the errors below.",
      data: readiness,
    };
  }

  // Transition status to READY
  await supabase
    .from("campaigns")
    .update({
      status: "READY",
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  if (campaign.active_version_id) {
    await supabase
      .from("campaign_versions")
      .update({
        status: "READY",
        published_at: new Date().toISOString(),
      })
      .eq("id", campaign.active_version_id);
  }

  await supabase.from("audit_logs").insert({
    business_id: business.id,
    user_id: user.id,
    action: "SETTINGS_CHANGED",
    entity_type: "campaign",
    entity_id: campaignId,
    new_values: { status: "READY" },
  });

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");
  return {
    success: true,
    message: "Campaign validated and marked as READY.",
    data: readiness,
  };
}

/**
 * 10. Duplicate Campaign
 */
export async function duplicateCampaignAction(
  campaignId: string
): Promise<CampaignActionResult<{ newCampaignId: string }>> {
  const { user, business } = await requireBusiness();
  const supabase = await createClient();

  // Load original campaign
  const { data: original } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("business_id", business.id)
    .is("deleted_at", null)
    .single();

  if (!original) {
    return { error: "Campaign not found or unauthorized." };
  }

  // Create duplicated campaign (ALWAYS DRAFT, NO provider IDs, NO runtime call records)
  const { data: newCampaign, error: insertError } = await supabase
    .from("campaigns")
    .insert({
      business_id: business.id,
      name: `${original.name} (Copy)`,
      offering_type: original.offering_type,
      industry: original.industry,
      objective: original.objective,
      description: original.description,
      status: "DRAFT",
      calling_days: original.calling_days,
      calling_start_time: original.calling_start_time,
      calling_end_time: original.calling_end_time,
      timezone: original.timezone,
      max_attempts: original.max_attempts,
      retry_interval_minutes: original.retry_interval_minutes,
      max_call_duration_seconds: original.max_call_duration_seconds,
    })
    .select("*")
    .single();

  if (insertError || !newCampaign) {
    return { error: "Failed to duplicate campaign." };
  }

  // Duplicate knowledge sources safely
  const { data: sources } = await supabase
    .from("campaign_sources")
    .select("*")
    .eq("campaign_id", campaignId);

  if (sources && sources.length > 0) {
    const duplicatedSources = sources.map((s) => ({
      campaign_id: newCampaign.id,
      source_type: s.source_type,
      source_name: s.source_name,
      source_url: s.source_url,
      raw_text: s.raw_text,
      processing_status: s.processing_status,
      metadata: s.metadata,
    }));
    await supabase.from("campaign_sources").insert(duplicatedSources);
  }

  // Create version 1 for new campaign
  const { data: newVersion } = await supabase
    .from("campaign_versions")
    .insert({
      campaign_id: newCampaign.id,
      version_number: 1,
      system_instructions: `Copy of ${original.name}`,
      knowledge_snapshot: {},
      configuration: {
        language: "en-IN",
        additionalLanguages: [],
        tone: "Friendly",
        salesAssistance: "Mild",
      },
      status: "DRAFT",
    })
    .select("id")
    .single();

  if (newVersion) {
    await supabase
      .from("campaigns")
      .update({ active_version_id: newVersion.id })
      .eq("id", newCampaign.id);
  }

  await supabase.from("audit_logs").insert({
    business_id: business.id,
    user_id: user.id,
    action: "CAMPAIGN_DUPLICATED",
    entity_type: "campaign",
    entity_id: newCampaign.id,
    old_values: { sourceCampaignId: campaignId },
  });

  revalidatePath("/campaigns");
  return {
    success: true,
    message: "Campaign duplicated successfully.",
    data: { newCampaignId: newCampaign.id },
  };
}

/**
 * 11. Soft-delete Campaign (30-day recycle bin)
 */
export async function deleteCampaignAction(
  campaignId: string
): Promise<CampaignActionResult> {
  const { user, business } = await requireBusiness();
  const supabase = await createClient();

  const { error } = await supabase
    .from("campaigns")
    .update({
      deleted_at: new Date().toISOString(),
      status: "DRAFT", // Automatically revoke READY if deleted
    })
    .eq("id", campaignId)
    .eq("business_id", business.id);

  if (error) {
    return { error: "Failed to delete campaign." };
  }

  await supabase.from("audit_logs").insert({
    business_id: business.id,
    user_id: user.id,
    action: "CAMPAIGN_DELETED",
    entity_type: "campaign",
    entity_id: campaignId,
  });

  revalidatePath("/campaigns");
  return { success: true, message: "Campaign moved to recycle bin (recoverable for 30 days)." };
}

/**
 * 12. Restore Campaign from recycle bin
 */
export async function restoreCampaignAction(
  campaignId: string
): Promise<CampaignActionResult> {
  const { user, business } = await requireBusiness();
  const supabase = await createClient();

  const { error } = await supabase
    .from("campaigns")
    .update({
      deleted_at: null,
    })
    .eq("id", campaignId)
    .eq("business_id", business.id);

  if (error) {
    return { error: "Failed to restore campaign." };
  }

  await supabase.from("audit_logs").insert({
    business_id: business.id,
    user_id: user.id,
    action: "CAMPAIGN_RESTORED",
    entity_type: "campaign",
    entity_id: campaignId,
  });

  revalidatePath("/campaigns");
  return { success: true, message: "Campaign restored from recycle bin." };
}

/**
 * 13. Start Campaign Execution
 */
export async function startCampaignAction(
  campaignId: string
): Promise<CampaignActionResult<{ sarvamCampaignId?: string }>> {
  const { user, business } = await requireBusiness();

  const launchResult = await launchCampaignExecution(campaignId, business.id, user.id);
  if (!launchResult.success) {
    return { error: launchResult.error || "Failed to launch campaign." };
  }

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");
  return {
    success: true,
    message: `Campaign launched successfully! ${launchResult.totalContactsQueued || 0} contacts queued.`,
    data: { sarvamCampaignId: launchResult.sarvamCampaignId },
  };
}

/**
 * 14. Pause Campaign Execution
 */
export async function pauseCampaignAction(
  campaignId: string
): Promise<CampaignActionResult> {
  const { user, business } = await requireBusiness();
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, status, sarvam_campaign_id")
    .eq("id", campaignId)
    .eq("business_id", business.id)
    .single();

  if (!campaign) {
    return { error: "Campaign not found." };
  }

  if (campaign.status !== "RUNNING") {
    return {
      error: `Cannot pause campaign with status: ${campaign.status}. Must be RUNNING.`,
    };
  }

  // Call Sarvam pause API if provider campaign exists
  if (campaign.sarvam_campaign_id) {
    try {
      await SarvamVoiceProvider.pauseCampaign(campaign.sarvam_campaign_id);
    } catch (err: unknown) {
      console.warn("Failed to pause Sarvam provider campaign:", err);
    }
  }

  const now = new Date().toISOString();
  await supabase
    .from("campaigns")
    .update({
      status: "PAUSED",
      paused_at: now,
      updated_at: now,
    })
    .eq("id", campaignId);

  await supabase.from("audit_logs").insert({
    business_id: business.id,
    user_id: user.id,
    action: "CAMPAIGN_PAUSED",
    entity_type: "campaign",
    entity_id: campaignId,
  });

  // Settle active quota reservation hold on pause
  await quotaService.settleCampaignReservations(campaignId, business.id);

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");
  return {
    success: true,
    message: "Campaign paused. Active calls will complete; no new calls will be placed.",
  };
}

/**
 * 15. Resume Campaign Execution
 */
export async function resumeCampaignAction(
  campaignId: string
): Promise<CampaignActionResult> {
  const { user, business } = await requireBusiness();
  const supabase = await createClient();

  // Concurrency check: Ensure no other campaign is RUNNING
  const { data: runningCampaigns } = await supabase
    .from("campaigns")
    .select("id, name")
    .eq("business_id", business.id)
    .eq("status", "RUNNING")
    .neq("id", campaignId)
    .is("deleted_at", null);

  if (runningCampaigns && runningCampaigns.length > 0) {
    return {
      error: `Cannot resume. Another campaign ("${runningCampaigns[0].name}") is currently RUNNING. Only one campaign may run per business.`,
    };
  }

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, status, sarvam_campaign_id")
    .eq("id", campaignId)
    .eq("business_id", business.id)
    .single();

  if (!campaign) {
    return { error: "Campaign not found." };
  }

  if (campaign.status !== "PAUSED") {
    return {
      error: `Cannot resume campaign with status: ${campaign.status}. Must be PAUSED.`,
    };
  }

  // Call Sarvam resume API if provider campaign exists
  if (campaign.sarvam_campaign_id) {
    try {
      await SarvamVoiceProvider.resumeCampaign(campaign.sarvam_campaign_id);
    } catch (err: unknown) {
      console.warn("Failed to resume Sarvam provider campaign:", err);
    }
  }

  const now = new Date().toISOString();
  await supabase
    .from("campaigns")
    .update({
      status: "RUNNING",
      updated_at: now,
    })
    .eq("id", campaignId);

  await supabase.from("audit_logs").insert({
    business_id: business.id,
    user_id: user.id,
    action: "CAMPAIGN_RESUMED",
    entity_type: "campaign",
    entity_id: campaignId,
  });

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");
  return { success: true, message: "Campaign resumed successfully." };
}

/**
 * 16. Stop Campaign Execution & Settle Quota Reservation
 */
export async function stopCampaignAction(
  campaignId: string
): Promise<CampaignActionResult> {
  const { user, business } = await requireBusiness();
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, status, sarvam_campaign_id")
    .eq("id", campaignId)
    .eq("business_id", business.id)
    .single();

  if (!campaign) {
    return { error: "Campaign not found." };
  }

  if (campaign.status !== "RUNNING" && campaign.status !== "PAUSED") {
    return {
      error: `Cannot stop campaign with status: ${campaign.status}. Must be RUNNING or PAUSED.`,
    };
  }

  if (campaign.sarvam_campaign_id) {
    try {
      await SarvamVoiceProvider.pauseCampaign(campaign.sarvam_campaign_id);
    } catch (err: unknown) {
      console.warn("Failed to stop Sarvam provider campaign:", err);
    }
  }

  const now = new Date().toISOString();
  await supabase
    .from("campaigns")
    .update({
      status: "COMPLETED",
      completed_at: now,
      updated_at: now,
    })
    .eq("id", campaignId);

  // Settle and release any active quota reservation hold
  await quotaService.settleCampaignReservations(campaignId, business.id);

  await supabase.from("audit_logs").insert({
    business_id: business.id,
    user_id: user.id,
    action: "CAMPAIGN_STOPPED",
    entity_type: "campaign",
    entity_id: campaignId,
  });

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");
  return { success: true, message: "Campaign stopped and completed successfully." };
}
