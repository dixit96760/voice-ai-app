import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCampaignWebhook, type NormalizedCallAttempt } from "@/lib/providers/sarvam/webhooks";
import { SarvamCampaignWebhookPayload } from "@/lib/providers/sarvam/types";
import { normalizeIndianPhone } from "@/lib/validation/phone";
import type { Json } from "@/lib/supabase/types";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface WebhookVerificationMetadata {
  payloadHash?: string;
  signatureValid?: boolean;
  signatureProvider?: string;
}

export interface WebhookProcessingResult {
  success: boolean;
  alreadyProcessed?: boolean;
  /** True when the provider should redeliver the event later. */
  retryable?: boolean;
  error?: string;
  callId?: string;
  attemptId?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A claim older than this is treated as abandoned (the processor crashed or
// timed out) and may be taken over by a redelivery.
const STALE_CLAIM_MS = 5 * 60 * 1000;

type ClaimResult =
  | { kind: "claimed"; eventId: string }
  | { kind: "processed" }
  | { kind: "in_flight" };

/**
 * Atomically claims a webhook event for processing. The unique index on
 * (provider, provider_event_id) guarantees that concurrent deliveries of the
 * same attempt cannot both proceed.
 */
async function claimWebhookEvent(
  supabase: AdminClient,
  payload: SarvamCampaignWebhookPayload,
  verification: WebhookVerificationMetadata
): Promise<ClaimResult> {
  const now = new Date().toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from("webhook_events")
    .insert({
      provider: "sarvam",
      event_type: "campaign.call.completed",
      provider_event_id: payload.attempt_id,
      payload: payload as unknown as Json,
      payload_hash: verification.payloadHash || null,
      signature_valid: verification.signatureValid ?? false,
      signature_provider: verification.signatureProvider || "sarvam",
      status: "PROCESSING",
      processed: false,
      processing_started_at: now,
    })
    .select("id")
    .single();

  if (inserted) {
    return { kind: "claimed", eventId: inserted.id };
  }

  // 23505 = unique_violation: this attempt was delivered before.
  if (insertError && insertError.code !== "23505") {
    throw new Error(`Failed to record webhook event: ${insertError.message}`);
  }

  const { data: existing } = await supabase
    .from("webhook_events")
    .select("id, processed, status, processing_started_at")
    .eq("provider", "sarvam")
    .eq("provider_event_id", payload.attempt_id)
    .maybeSingle();

  if (!existing) {
    throw new Error("Webhook event could not be recorded.");
  }

  if (existing.processed) {
    return { kind: "processed" };
  }

  const claimedAt = existing.processing_started_at
    ? Date.parse(existing.processing_started_at)
    : 0;
  if (existing.status === "PROCESSING" && Date.now() - claimedAt < STALE_CLAIM_MS) {
    return { kind: "in_flight" };
  }

  // Take over a failed or abandoned claim. Matching the previous claim time
  // makes this a compare-and-set, so only one concurrent retry wins.
  let takeover = supabase
    .from("webhook_events")
    .update({ status: "PROCESSING", processing_started_at: now, processing_error: null })
    .eq("id", existing.id)
    .eq("processed", false);
  takeover = existing.processing_started_at
    ? takeover.eq("processing_started_at", existing.processing_started_at)
    : takeover.is("processing_started_at", null);

  const { data: taken } = await takeover.select("id");
  return taken && taken.length > 0
    ? { kind: "claimed", eventId: existing.id }
    : { kind: "in_flight" };
}

async function resolveCampaign(
  supabase: AdminClient,
  providerCampaignId: string
): Promise<{ id: string; business_id: string } | null> {
  const { data: bySarvamId } = await supabase
    .from("campaigns")
    .select("id, business_id")
    .eq("sarvam_campaign_id", providerCampaignId)
    .maybeSingle();

  if (bySarvamId) return bySarvamId;

  // Some launches register our own campaign UUID as the provider campaign id.
  if (!UUID_PATTERN.test(providerCampaignId)) return null;

  const { data: byId } = await supabase
    .from("campaigns")
    .select("id, business_id")
    .eq("id", providerCampaignId)
    .maybeSingle();

  return byId || null;
}

async function resolveContactId(
  supabase: AdminClient,
  businessId: string,
  normalized: NormalizedCallAttempt,
  searchPhone: string,
  payload: SarvamCampaignWebhookPayload
): Promise<string> {
  // Preferred: match on the cohort `user_identifier` we sent (our contact id).
  if (normalized.providerUserIdentifier && UUID_PATTERN.test(normalized.providerUserIdentifier)) {
    const { data: identified } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", normalized.providerUserIdentifier)
      .eq("business_id", businessId)
      .limit(1);
    if (identified?.[0]?.id) return identified[0].id;
  }

  // Fallback: match on the phone number, in normalized or raw form.
  const phoneCandidates = Array.from(
    new Set([searchPhone, normalized.userPhoneNumber].filter(Boolean))
  );
  const { data: matchedContacts } = await supabase
    .from("contacts")
    .select("id")
    .eq("business_id", businessId)
    .in("phone", phoneCandidates)
    .limit(1);
  if (matchedContacts?.[0]?.id) return matchedContacts[0].id;

  // Not in the directory: create the contact so the call is not lost.
  const { data: newContact, error } = await supabase
    .from("contacts")
    .insert({
      business_id: businessId,
      name: (payload.output_agent_variables?.customer_name as string) || "Lead",
      phone: searchPhone || normalized.userPhoneNumber || "UNKNOWN",
      status: "ACTIVE",
    })
    .select("id")
    .single();

  if (error || !newContact) {
    throw new Error(`Failed to resolve contact: ${error?.message || "unknown error"}`);
  }
  return newContact.id;
}

/**
 * Idempotent processor for Sarvam outbound campaign call webhooks.
 *
 * Each attempt is claimed exactly once. If processing fails part-way, the
 * event is marked FAILED and a redelivery resumes it: the call row is reused
 * and every dependent write is an upsert or an existence-checked insert, so
 * nothing (including billable usage) is recorded twice.
 */
export async function processCampaignWebhook(
  payload: SarvamCampaignWebhookPayload,
  verification: WebhookVerificationMetadata = {},
  client?: AdminClient
): Promise<WebhookProcessingResult> {
  const attemptId = payload.attempt_id;
  if (!attemptId) {
    return {
      success: false,
      retryable: false,
      error: "Missing required 'attempt_id' in webhook payload.",
    };
  }

  const supabase = client ?? createAdminClient();

  const claim = await claimWebhookEvent(supabase, payload, verification);
  if (claim.kind === "processed") {
    return { success: true, alreadyProcessed: true, attemptId };
  }
  if (claim.kind === "in_flight") {
    return {
      success: false,
      retryable: true,
      error: "This webhook event is already being processed.",
      attemptId,
    };
  }

  try {
    const outcome = await applyCallAttempt(supabase, payload);
    const finishedAt = new Date().toISOString();

    await supabase
      .from("webhook_events")
      .update({
        business_id: outcome.businessId,
        status: outcome.callId ? "PROCESSED" : "IGNORED",
        processed: true,
        processed_at: finishedAt,
        processing_error: outcome.error || null,
      })
      .eq("id", claim.eventId);

    if (!outcome.callId) {
      // Permanent: retrying an event for an unknown campaign cannot succeed.
      return { success: false, retryable: false, error: outcome.error, attemptId };
    }
    return { success: true, callId: outcome.callId, attemptId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("webhook_events")
      .update({
        status: "FAILED",
        processing_error: message,
        processed_at: new Date().toISOString(),
      })
      .eq("id", claim.eventId);

    return { success: false, retryable: true, error: message, attemptId };
  }
}

async function applyCallAttempt(
  supabase: AdminClient,
  payload: SarvamCampaignWebhookPayload
): Promise<{ businessId: string | null; callId?: string; error?: string }> {
  const attemptId = payload.attempt_id;
  const normalized = normalizeCampaignWebhook(payload);

  // 1. Match Campaign
  const campaign = await resolveCampaign(supabase, normalized.providerCampaignId);
  if (!campaign) {
    return {
      businessId: null,
      error: `Unmatched campaign ID: ${normalized.providerCampaignId}`,
    };
  }
  const businessId = campaign.business_id;
  const campaignId = campaign.id;

  // 2. Match or create the contact
  const normPhone = normalizeIndianPhone(normalized.userPhoneNumber);
  const searchPhone =
    (normPhone.isValid && normPhone.normalized) || normalized.userPhoneNumber;
  const contactId = await resolveContactId(supabase, businessId, normalized, searchPhone, payload);

  // 3. Find campaign_contact link
  const { data: link } = await supabase
    .from("campaign_contacts")
    .select("id, attempt_count")
    .eq("campaign_id", campaignId)
    .eq("contact_id", contactId)
    .maybeSingle();
  const campaignContactId = link?.id || null;

  // 4. Find or create the call row (one per provider attempt)
  const now = new Date().toISOString();
  const { data: existingCall } = await supabase
    .from("calls")
    .select("id")
    .eq("provider", "sarvam")
    .eq("provider_attempt_id", attemptId)
    .maybeSingle();

  let callId = existingCall?.id;
  const isNewCall = !callId;

  if (!callId) {
    const { data: callRecord, error: callError } = await supabase
      .from("calls")
      .insert({
        business_id: businessId,
        campaign_id: campaignId,
        campaign_contact_id: campaignContactId,
        contact_id: contactId,
        direction: "OUTBOUND",
        provider: "sarvam",
        provider_call_id: attemptId,
        provider_attempt_id: attemptId,
        provider_interaction_id: normalized.providerInteractionId,
        provider_campaign_id: normalized.providerCampaignId,
        status: normalized.callStatus,
        duration_seconds: normalized.durationSeconds,
        outcome: normalized.callOutcome,
        interest_level: normalized.interestLevel,
        short_summary: normalized.shortSummary,
        ended_at: now,
      })
      .select("id")
      .single();

    if (callError || !callRecord) {
      throw new Error(`Failed to insert call record: ${callError?.message}`);
    }
    callId = callRecord.id;
  }

  // 5. Count the attempt against the campaign contact once, when the call is
  //    first recorded, so redeliveries do not inflate attempt counts.
  if (link && isNewCall) {
    const { error } = await supabase
      .from("campaign_contacts")
      .update({
        attempt_count: (link.attempt_count || 0) + 1,
        last_call_at: now,
        status: normalized.callStatus,
        updated_at: now,
      })
      .eq("id", link.id);
    if (error) throw new Error(`Failed to update campaign contact: ${error.message}`);
  }

  // 6. Call attempt record
  const { data: existingAttempt } = await supabase
    .from("call_attempts")
    .select("id")
    .eq("call_id", callId)
    .limit(1);
  if (!existingAttempt?.length) {
    const { error } = await supabase.from("call_attempts").insert({
      campaign_contact_id: campaignContactId,
      call_id: callId,
      attempt_number: (normalized.retryMetadata.attempt_number as number) || 1,
      provider_call_id: attemptId,
      provider_attempt_id: attemptId,
      status: normalized.callStatus,
      duration_seconds: normalized.durationSeconds,
      failure_reason: normalized.failureReason,
      retry_metadata: normalized.retryMetadata as unknown as Json,
      ended_at: now,
    });
    if (error) throw new Error(`Failed to record call attempt: ${error.message}`);
  }

  // 7. Call transcript (Preserving Indic + English)
  if (normalized.transcriptText || normalized.transcriptJson.length > 0) {
    const { error } = await supabase.from("call_transcripts").upsert(
      {
        call_id: callId,
        transcript_text: normalized.transcriptText || "No audible transcript captured.",
        transcript_json: normalized.transcriptJson as unknown as Json,
        language: "en-IN",
      },
      { onConflict: "call_id" }
    );
    if (error) throw new Error(`Failed to save transcript: ${error.message}`);
  }

  // 8. Call recording (if URL provided in webhook payload)
  const recordingUrl = payload.recording_url || null;
  if (recordingUrl) {
    const { error } = await supabase.from("call_recordings").upsert(
      {
        call_id: callId,
        provider_recording_id: normalized.providerInteractionId || attemptId,
        storage_path: recordingUrl,
        duration_seconds: normalized.durationSeconds,
        mime_type: "audio/wav",
        available_at: now,
        created_at: now,
      },
      { onConflict: "call_id" }
    );
    if (error) throw new Error(`Failed to save recording: ${error.message}`);
  }

  // 9. Call analysis
  {
    const { error } = await supabase.from("call_analysis").upsert(
      {
        call_id: callId,
        short_summary: normalized.shortSummary,
        interest_level: normalized.interestLevel,
        customer_intent: normalized.callOutcome || "Unknown",
        questions_asked: normalized.questionsAsked,
        objections: normalized.objections,
        recommended_next_action: normalized.recommendedNextAction,
        outcome: normalized.callOutcome,
        analysis_version: 1,
      },
      { onConflict: "call_id" }
    );
    if (error) throw new Error(`Failed to save call analysis: ${error.message}`);
  }

  // 10. Callback scheduling
  if (normalized.callbackRequested && normalized.callbackDatetime) {
    const { data: existingCallback } = await supabase
      .from("callbacks")
      .select("id")
      .eq("call_id", callId)
      .limit(1);

    if (!existingCallback?.length) {
      // Fall back to +24 hours when the agent captured a non-parseable time.
      let scheduledDate = new Date(normalized.callbackDatetime);
      if (isNaN(scheduledDate.getTime())) {
        scheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }

      const { error } = await supabase.from("callbacks").insert({
        business_id: businessId,
        campaign_id: campaignId,
        contact_id: contactId,
        call_id: callId,
        scheduled_for: scheduledDate.toISOString(),
        timezone: "Asia/Kolkata",
        status: "SCHEDULED",
        notes: `Requested callback from call attempt ${attemptId}: ${normalized.callbackDatetime}`,
      });
      if (error) throw new Error(`Failed to schedule callback: ${error.message}`);
    }
  }

  // 11. DNC vs Wrong Number (Rule 1: Wrong number != DNC)
  if (normalized.dncRequested) {
    // Explicit opt-out -> mark contact and add to business DNC list
    await supabase
      .from("contacts")
      .update({ is_dnc: true, updated_at: now })
      .eq("id", contactId);

    const dncPhone = searchPhone || normalized.userPhoneNumber;
    if (dncPhone) {
      const { error } = await supabase.from("dnc_numbers").upsert(
        {
          business_id: businessId,
          phone_number: dncPhone,
          reason: "customer_requested",
          source_call_id: callId,
        },
        { onConflict: "business_id,phone_number" }
      );
      if (error) throw new Error(`Failed to record DNC request: ${error.message}`);
    }
  } else if (normalized.wrongNumber) {
    // Person who answered is not the intended lead -> mark wrong number, do NOT add to DNC
    await supabase
      .from("contacts")
      .update({ is_wrong_number: true, status: "WRONG_NUMBER", updated_at: now })
      .eq("id", contactId);
  }

  // 12. Billable usage events, recorded once per call
  const { data: existingUsage } = await supabase
    .from("usage_events")
    .select("id")
    .eq("call_id", callId)
    .limit(1);

  if (!existingUsage?.length) {
    const billableMinutes = Math.ceil((normalized.durationSeconds || 0) / 60);
    const { error } = await supabase.from("usage_events").insert([
      {
        business_id: businessId,
        campaign_id: campaignId,
        call_id: callId,
        event_type: "OUTBOUND_CALL_ATTEMPT",
        quantity: 1,
        unit: "attempt",
        metadata: { attempt_id: attemptId },
      },
      ...(normalized.durationSeconds > 0
        ? [
            {
              business_id: businessId,
              campaign_id: campaignId,
              call_id: callId,
              event_type: "CALL_DURATION",
              quantity: normalized.durationSeconds,
              unit: "second",
              metadata: { duration_seconds: normalized.durationSeconds },
            },
            {
              business_id: businessId,
              campaign_id: campaignId,
              call_id: callId,
              event_type: "voice_minutes",
              quantity: billableMinutes,
              unit: "minute",
              metadata: {
                duration_seconds: normalized.durationSeconds,
                billable_minutes: billableMinutes,
              },
            },
          ]
        : []),
    ]);
    if (error) throw new Error(`Failed to record usage: ${error.message}`);
  }

  return { businessId, callId };
}
