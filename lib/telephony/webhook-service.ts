import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCampaignWebhook } from "@/lib/providers/sarvam/webhooks";
import { SarvamCampaignWebhookPayload } from "@/lib/providers/sarvam/types";
import { normalizeIndianPhone } from "@/lib/validation/phone";
import type { Json } from "@/lib/supabase/types";

export interface WebhookVerificationMetadata {
  payloadHash?: string;
  signatureValid?: boolean;
  signatureProvider?: string;
}

export interface WebhookProcessingResult {
  success: boolean;
  alreadyProcessed?: boolean;
  error?: string;
  callId?: string;
  attemptId?: string;
}

/**
 * High-performance, idempotent Webhook Event Processor for Sarvam Outbound Campaigns.
 */
export async function processCampaignWebhook(
  payload: SarvamCampaignWebhookPayload,
  verification: WebhookVerificationMetadata = {}
): Promise<WebhookProcessingResult> {
  const attemptId = payload.attempt_id;
  if (!attemptId) {
    return { success: false, error: "Missing required 'attempt_id' in webhook payload." };
  }

  const supabase = createAdminClient();

  // 1. IDEMPOTENCY CHECK
  const { data: existingEvent } = await supabase
    .from("webhook_events")
    .select("id, processed")
    .eq("provider", "sarvam")
    .eq("provider_event_id", attemptId)
    .single();

  if (existingEvent && existingEvent.processed) {
    return { success: true, alreadyProcessed: true };
  }

  // 2. Persist Raw Webhook Event
  let webhookEventId = existingEvent?.id;
  if (!webhookEventId) {
    const { data: newEvent } = await supabase
      .from("webhook_events")
      .insert({
        provider: "sarvam",
        event_type: "campaign.call.completed",
        provider_event_id: attemptId,
        payload: payload as unknown as Json,
        payload_hash: verification.payloadHash || null,
        signature_valid: verification.signatureValid ?? false,
        signature_provider: verification.signatureProvider || "sarvam",
        status: "PROCESSING",
        processed: false,
      })
      .select("id")
      .single();

    webhookEventId = newEvent?.id;
  }

  // 3. Normalize Attempt Payload
  const normalized = normalizeCampaignWebhook(payload);

  // 4. Match Campaign
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, business_id")
    .eq("sarvam_campaign_id", normalized.providerCampaignId)
    .single();

  const businessId = campaign?.business_id;
  const campaignId = campaign?.id || null;

  if (!businessId) {
    // Attempt match directly by campaignId if providerCampaignId was set to UUID
    const { data: fallbackCamp } = await supabase
      .from("campaigns")
      .select("id, business_id")
      .eq("id", normalized.providerCampaignId)
      .single();

    if (!fallbackCamp) {
      // Record unmapped event for diagnostic inspection
      if (webhookEventId) {
        await supabase
          .from("webhook_events")
          .update({
            processing_error: `Unmatched campaign ID: ${normalized.providerCampaignId}`,
            processed: true,
            processed_at: new Date().toISOString(),
          })
          .eq("id", webhookEventId);
      }
      return { success: false, error: `Unmatched campaign: ${normalized.providerCampaignId}` };
    }
  }

  const activeBusinessId = businessId || (campaign as { business_id: string })?.business_id;

  // 5. Match or Find Contact
  const normPhone = normalizeIndianPhone(normalized.userPhoneNumber);
  const searchPhone = normPhone.isValid ? normPhone.normalized : normalized.userPhoneNumber;

  let contactId: string | null = null;

  // 5a. Preferred: match on the cohort `user_identifier` we sent (our contact id).
  if (
    normalized.providerUserIdentifier &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      normalized.providerUserIdentifier
    )
  ) {
    const { data: identified } = await supabase
      .from("contacts")
      .select("id, is_dnc, is_wrong_number")
      .eq("id", normalized.providerUserIdentifier)
      .eq("business_id", activeBusinessId)
      .limit(1);
    contactId = identified?.[0]?.id || null;
  }

  // 5b. Fallback: match on phone number.
  if (!contactId) {
    const { data: matchedContacts } = await supabase
      .from("contacts")
      .select("id, is_dnc, is_wrong_number")
      .eq("business_id", activeBusinessId)
      .or(`phone.eq.${searchPhone},phone.eq.${normalized.userPhoneNumber}`)
      .limit(1);

    contactId = matchedContacts?.[0]?.id || null;
  }

  // If no contact found in directory, create one automatically
  if (!contactId) {
    const { data: newContact } = await supabase
      .from("contacts")
      .insert({
        business_id: activeBusinessId,
        name: (payload.output_agent_variables?.customer_name as string) || "Lead",
        phone: searchPhone || normalized.userPhoneNumber || "UNKNOWN",
        status: "ACTIVE",
      })
      .select("id")
      .single();

    contactId = newContact?.id || null;
  }

  if (!contactId) {
    return { success: false, error: "Failed to resolve contact." };
  }

  // 6. Find campaign_contact link
  let campaignContactId: string | null = null;
  if (campaignId) {
    const { data: link } = await supabase
      .from("campaign_contacts")
      .select("id, attempt_count")
      .eq("campaign_id", campaignId)
      .eq("contact_id", contactId)
      .single();

    campaignContactId = link?.id || null;

    if (link) {
      // Update campaign_contact status and attempt count
      await supabase
        .from("campaign_contacts")
        .update({
          attempt_count: (link.attempt_count || 0) + 1,
          last_call_at: new Date().toISOString(),
          status: normalized.callStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", link.id);
    }
  }

  // 7. Upsert Calls Record
  const now = new Date().toISOString();
  const { data: callRecord, error: callError } = await supabase
    .from("calls")
    .insert({
      business_id: activeBusinessId,
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
    return { success: false, error: `Failed to insert call record: ${callError?.message}` };
  }

  const callId = callRecord.id;

  // 8. Insert Call Attempt Record
  await supabase.from("call_attempts").insert({
    campaign_contact_id: campaignContactId || callId,
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

  // 9. Persist Call Transcript (Preserving Indic + English)
  if (normalized.transcriptText || normalized.transcriptJson.length > 0) {
    await supabase.from("call_transcripts").insert({
      call_id: callId,
      transcript_text: normalized.transcriptText || "No audible transcript captured.",
      transcript_json: normalized.transcriptJson as unknown as Json,
      language: "en-IN",
    });
  }

  // 9b. Persist Call Recording (if URL provided in webhook payload)
  const recordingUrl = payload.recording_url || null;
  if (recordingUrl) {
    await supabase.from("call_recordings").upsert(
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
  }

  // 10. Persist Call Analysis
  await supabase.from("call_analysis").insert({
    call_id: callId,
    short_summary: normalized.shortSummary,
    interest_level: normalized.interestLevel,
    customer_intent: normalized.callOutcome || "Unknown",
    questions_asked: normalized.questionsAsked,
    objections: normalized.objections,
    recommended_next_action: normalized.recommendedNextAction,
    outcome: normalized.callOutcome,
    analysis_version: 1,
  });

  // 11. Handle Callback Scheduling
  if (normalized.callbackRequested && normalized.callbackDatetime) {
    // Parse scheduled callback date or fallback to +24 hours
    let scheduledDate: Date;
    try {
      scheduledDate = new Date(normalized.callbackDatetime);
      if (isNaN(scheduledDate.getTime())) {
        scheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }
    } catch {
      scheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    await supabase.from("callbacks").insert({
      business_id: activeBusinessId,
      campaign_id: campaignId,
      contact_id: contactId,
      call_id: callId,
      scheduled_for: scheduledDate.toISOString(),
      timezone: "Asia/Kolkata",
      status: "SCHEDULED",
      notes: `Requested callback from call attempt ${attemptId}: ${normalized.callbackDatetime}`,
    });
  }

  // 12. DNC vs Wrong Number (Rule 1: Wrong number != DNC)
  if (normalized.dncRequested) {
    // Explicit opt-out -> mark contact and add to business DNC list
    await supabase
      .from("contacts")
      .update({ is_dnc: true, updated_at: now })
      .eq("id", contactId);

    const dncPhone = searchPhone || normalized.userPhoneNumber;
    if (dncPhone) {
      await supabase.from("dnc_numbers").upsert(
        {
          business_id: activeBusinessId,
          phone_number: dncPhone,
          reason: "customer_requested",
          source_call_id: callId,
        },
        { onConflict: "business_id,phone_number" }
      );
    }
  } else if (normalized.wrongNumber) {
    // Person who answered is not the intended lead -> mark wrong number, do NOT add to DNC
    await supabase
      .from("contacts")
      .update({ is_wrong_number: true, status: "WRONG_NUMBER", updated_at: now })
      .eq("id", contactId);
  }

  // 13. Emit Billable Usage Events
  const billableMinutes = Math.ceil((normalized.durationSeconds || 0) / 60);
  await supabase.from("usage_events").insert([
    {
      business_id: activeBusinessId,
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
            business_id: activeBusinessId,
            campaign_id: campaignId,
            call_id: callId,
            event_type: "CALL_DURATION",
            quantity: normalized.durationSeconds,
            unit: "second",
            metadata: { duration_seconds: normalized.durationSeconds },
          },
          {
            business_id: activeBusinessId,
            campaign_id: campaignId,
            call_id: callId,
            event_type: "voice_minutes",
            quantity: billableMinutes,
            unit: "minute",
            metadata: { duration_seconds: normalized.durationSeconds, billable_minutes: billableMinutes },
          },
        ]
      : []),
  ]);

  // 14. Mark Webhook Processed
  if (webhookEventId) {
    await supabase
      .from("webhook_events")
      .update({
        business_id: activeBusinessId,
        processed: true,
        processed_at: now,
      })
      .eq("id", webhookEventId);
  }

  return { success: true, callId, attemptId };
}
