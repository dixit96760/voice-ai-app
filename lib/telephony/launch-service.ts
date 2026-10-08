import { createClient } from "@/lib/supabase/server";
import {
  SarvamVoiceProvider,
  buildCampaignWebhookUrl,
  getDefaultDialerNumbers,
} from "@/lib/providers/sarvam";
import { buildCampaignBrief, buildSarvamAgentConfig } from "@/lib/providers/sarvam/agent";
import { validateCampaignReadiness } from "@/lib/campaign/validator";
import { normalizeIndianPhone } from "@/lib/validation/phone";
import { quotaService } from "@/lib/billing/quota-service";
import type { Database } from "@/lib/supabase/types";

type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];
type CampaignSource = Database["public"]["Tables"]["campaign_sources"]["Row"];
type Contact = Database["public"]["Tables"]["contacts"]["Row"];

export interface CampaignLaunchResult {
  success: boolean;
  error?: string;
  sarvamCampaignId?: string;
  sarvamCohortId?: string;
  totalContactsQueued?: number;
  excludedDncCount?: number;
}

/**
 * Orchestrates the full, safe campaign launch flow:
 * 1. Checks campaign READY state.
 * 2. Enforces: Only ONE campaign per business can be RUNNING.
 * 3. Verifies business phone number.
 * 4. Filters contacts (excluding DNC / wrong numbers).
 * 5. Creates Sarvam Campaign and streams Cohort.
 * 6. Sets campaign to RUNNING and records audit logs.
 */
export async function launchCampaignExecution(
  campaignId: string,
  businessId: string,
  userId: string
): Promise<CampaignLaunchResult> {
  const supabase = await createClient();

  // 1. Fetch Campaign
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .single();

  if (campaignError || !campaign) {
    return { success: false, error: "Campaign not found or unauthorized." };
  }

  if (campaign.status !== "READY") {
    return {
      success: false,
      error: `Campaign cannot be launched from current status: ${campaign.status}. Must be READY.`,
    };
  }

  // 2. Fetch Business Profile
  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .single();

  if (!business) {
    return { success: false, error: "Business profile not found." };
  }

  // 3. CONCURRENCY GUARD: Check if any other campaign is already RUNNING
  const { data: runningCampaigns } = await supabase
    .from("campaigns")
    .select("id, name")
    .eq("business_id", businessId)
    .eq("status", "RUNNING")
    .neq("id", campaignId)
    .is("deleted_at", null);

  if (runningCampaigns && runningCampaigns.length > 0) {
    return {
      success: false,
      error: `Another campaign ("${runningCampaigns[0].name}") is currently RUNNING. Only one campaign may run per business concurrently.`,
    };
  }

  // 4. Fetch Active Phone Number(s)
  // The first entry is the primary dialer; additional numbers on the same
  // Sarvam connection form the pool used for agent phone rotation.
  const { data: phoneNumbers } = await supabase
    .from("phone_numbers")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "ACTIVE")
    .order("is_default", { ascending: false })
    .limit(5);

  // Platform dialer numbers on the shared Sarvam connection
  // (SARVAM_DIALER_PHONE_NUMBERS) serve every business, so a business only
  // needs its own number when no platform dialer is configured.
  const providerDialers = getDefaultDialerNumbers();
  const activePhone = phoneNumbers?.[0] || null;
  if (!activePhone && providerDialers.length === 0) {
    return {
      success: false,
      error:
        "No caller phone number is configured. Set SARVAM_DIALER_PHONE_NUMBERS for the platform or add an active phone number for this business before launching.",
    };
  }

  // 5. Fetch Campaign Version and Knowledge Sources
  let activeVersion = null;
  if (campaign.active_version_id) {
    const { data: v } = await supabase
      .from("campaign_versions")
      .select("*")
      .eq("id", campaign.active_version_id)
      .single();
    activeVersion = v;
  }

  if (!activeVersion) {
    return { success: false, error: "Active campaign version not found." };
  }

  const { data: sources } = await supabase
    .from("campaign_sources")
    .select("*")
    .eq("campaign_id", campaignId);

  // 6. Fetch Enrolled Contacts
  const { data: enrolledLinks } = await supabase
    .from("campaign_contacts")
    .select(`
      id,
      contact_id,
      status,
      contacts (*)
    `)
    .eq("campaign_id", campaignId);

  type CampaignContactRow = {
    id: string;
    contact_id: string;
    status: string;
    contacts: Contact | Contact[] | null;
  };

  const rawContacts: Contact[] = ((enrolledLinks as unknown as CampaignContactRow[]) || [])
    .map((item) => (Array.isArray(item.contacts) ? item.contacts[0] : item.contacts))
    .filter((c): c is Contact => Boolean(c));

  // 7. Validate Pre-flight Readiness
  const readiness = validateCampaignReadiness({
    campaign: campaign as Campaign,
    sources: (sources || []) as CampaignSource[],
    contactCount: rawContacts.length,
    businessId,
  });

  if (!readiness.ready) {
    return {
      success: false,
      error: `Pre-flight readiness failed: ${readiness.errors.map((e) => e.message).join(", ")}`,
    };
  }

  // 8. Filter out DNC & Wrong Numbers. The business DNC list is checked as
  //    well as the contact flag, so an opted-out number stays blocked even if
  //    it was re-imported or exists under another contact record.
  const { data: dncRecords, error: dncError } = await supabase
    .from("dnc_numbers")
    .select("phone_number")
    .eq("business_id", businessId);

  if (dncError) {
    return {
      success: false,
      error: "Could not load the Do-Not-Call list. Launch aborted to avoid calling opted-out numbers.",
    };
  }

  const dncPhones = new Set<string>();
  for (const r of dncRecords || []) {
    dncPhones.add(r.phone_number);
    const p = normalizeIndianPhone(r.phone_number);
    if (p.isValid && p.normalized) dncPhones.add(p.normalized);
  }

  let excludedDncCount = 0;
  const eligibleContacts: Contact[] = [];

  for (const c of rawContacts) {
    if (c.is_dnc || c.is_wrong_number || c.status === "INACTIVE") {
      excludedDncCount++;
      continue;
    }
    const p = normalizeIndianPhone(c.phone);
    if (!p.isValid || !p.normalized) {
      excludedDncCount++;
      continue;
    }
    if (dncPhones.has(c.phone) || dncPhones.has(p.normalized)) {
      excludedDncCount++;
      continue;
    }
    eligibleContacts.push(c);
  }

  if (eligibleContacts.length === 0) {
    return {
      success: false,
      error: "All assigned contacts are flagged as DNC or have invalid phone numbers. No eligible leads to call.",
    };
  }

  // 9. ATOMIC CONCURRENCY & QUOTA RESERVATION
  const estimatedMinutes = Math.max(
    1,
    Math.ceil(eligibleContacts.length * ((campaign.max_call_duration_seconds || 120) / 60))
  );
  const quotaReservation = await quotaService.acquireCampaignLaunchAndQuota(
    businessId,
    campaignId,
    eligibleContacts.length,
    estimatedMinutes
  );

  if (!quotaReservation.success) {
    return {
      success: false,
      error: quotaReservation.error || "Launch rejected: insufficient quota or campaign already running.",
    };
  }

  // The reservation RPC already marked the campaign RUNNING. Any failure from
  // here on must release the minutes and restore the previous status, or the
  // campaign stays RUNNING and blocks every future launch for the business.
  const abortLaunch = async (error: string): Promise<CampaignLaunchResult> => {
    if (quotaReservation.reservationId) {
      await quotaService.releaseQuotaReservation(quotaReservation.reservationId, businessId, false);
    }
    await supabase
      .from("campaigns")
      .update({
        status: campaign.status,
        started_at: campaign.started_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaignId)
      .eq("status", "RUNNING");
    return { success: false, error };
  };

  // 10. Build Agent Configuration & Prompt
  let agentConfig: ReturnType<typeof buildSarvamAgentConfig>;
  try {
    agentConfig = buildSarvamAgentConfig({
      business,
      campaign: campaign as Campaign,
      version: activeVersion,
      sources: (sources || []) as CampaignSource[],
    });
  } catch (err: unknown) {
    return abortLaunch(`Failed to build the voice agent configuration: ${(err as Error).message}`);
  }

  // Webhook URL registered with Sarvam. The shared token (when configured)
  // lets us verify inbound callbacks, and the metadata is echoed back on
  // every webhook payload for correlation.
  const webhookUrl = buildCampaignWebhookUrl();

  // Dialer pool. Only numbers registered with the Sarvam telephony connection
  // can dial, so a configured SARVAM_DIALER_PHONE_NUMBERS pool takes precedence
  // over the locally stored business number. Any additional numbers form the
  // pool used for agent phone rotation.
  const rotationPool = providerDialers.length
    ? []
    : (phoneNumbers || [])
        .slice(1)
        .filter(
          (phone) =>
            (phone.provider_connection_id || null) ===
            (activePhone?.provider_connection_id || null)
        )
        .map((phone) => phone.phone_number);

  const dialerNumbers = providerDialers.length
    ? providerDialers
    : [activePhone!.phone_number, ...rotationPool];

  // 11. Create or Reuse Sarvam Campaign
  let sarvamCampaignId = campaign.sarvam_campaign_id;

  if (!sarvamCampaignId) {
    try {
      const campResponse = await SarvamVoiceProvider.createCampaign({
        name: `${business.business_name} - ${campaign.name}`.slice(0, 100),
        description: campaign.description || campaign.objective || undefined,
        app_id: agentConfig.app_id || campaign.sarvam_agent_id || undefined,
        app_version: agentConfig.app_version || undefined,
        phone_number_id: activePhone?.provider_connection_id || undefined,
        caller_id: dialerNumbers[0],
        caller_ids: dialerNumbers.slice(1),
        schedule: {
          start_time: campaign.calling_start_time,
          end_time: campaign.calling_end_time,
          allowed_days: campaign.calling_days || [1, 2, 3, 4, 5, 6],
          timezone: campaign.timezone || "Asia/Kolkata",
        },
        retry_policy: {
          max_attempts: campaign.max_attempts,
          retry_interval_minutes: campaign.retry_interval_minutes,
          enable_phone_rotation: campaign.enable_phone_rotation ?? false,
        },
        max_call_duration_seconds: campaign.max_call_duration_seconds,
        webhook: {
          url: webhookUrl,
          metadata: {
            platform: "reachkaro-ai",
            business_id: businessId,
            campaign_id: campaignId,
          },
        },
      });

      sarvamCampaignId = campResponse.campaign_id;
    } catch (err: unknown) {
      return abortLaunch(`Failed to create provider campaign on Sarvam: ${(err as Error).message}`);
    }

    // Persist immediately so a retry after a later failure reuses this Sarvam
    // campaign instead of creating a duplicate.
    await supabase
      .from("campaigns")
      .update({ sarvam_campaign_id: sarvamCampaignId, updated_at: new Date().toISOString() })
      .eq("id", campaignId);
  }

  // 12. Stream Cohort of Eligible Contacts
  let cohortId = "";
  try {
    const cohortResult = await SarvamVoiceProvider.streamCohort({
      sarvamCampaignId,
      cohortName: `${campaign.name} Cohort`,
      contacts: eligibleContacts,
      campaignOffering: campaign.offering_type || undefined,
      businessName: business.business_name,
      campaignObjective: campaign.objective || undefined,
      campaignId,
      campaignBrief: buildCampaignBrief({
        business,
        campaign: campaign as Campaign,
        sources: (sources || []) as CampaignSource[],
      }),
      appVariables: Array.isArray(
        (activeVersion.configuration as Record<string, unknown> | null)?.appVariables
      )
        ? ((activeVersion.configuration as Record<string, unknown>).appVariables as string[])
        : undefined,
    });

    cohortId = cohortResult.cohortId;
  } catch (err: unknown) {
    return abortLaunch(`Failed to stream contacts cohort to Sarvam: ${(err as Error).message}`);
  }

  // 13. Update Database: Set Campaign to RUNNING
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("campaigns")
    .update({
      status: "RUNNING",
      started_at: now,
      sarvam_campaign_id: sarvamCampaignId,
      sarvam_cohort_id: cohortId,
      updated_at: now,
    })
    .eq("id", campaignId);

  if (updateError) {
    return abortLaunch(`Failed to transition campaign to RUNNING: ${updateError.message}`);
  }

  // 13. Audit Log
  await supabase.from("audit_logs").insert({
    business_id: businessId,
    user_id: userId,
    action: "CAMPAIGN_LAUNCHED",
    entity_type: "campaign",
    entity_id: campaignId,
    new_values: {
      status: "RUNNING",
      sarvam_campaign_id: sarvamCampaignId,
      sarvam_cohort_id: cohortId,
      total_queued: eligibleContacts.length,
      excluded_dnc: excludedDncCount,
    },
  });

  return {
    success: true,
    sarvamCampaignId,
    sarvamCohortId: cohortId,
    totalContactsQueued: eligibleContacts.length,
    excludedDncCount,
  };
}
