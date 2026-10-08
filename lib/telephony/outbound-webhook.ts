import type { SarvamCampaignWebhookPayload } from "@/lib/providers/sarvam/types";

/** Instant-outbound payload (callback calls); see Sarvam's webhook docs. */
export interface SarvamInstantOutboundPayload {
  attempt_id?: string;
  status?: "connected" | "no_answer" | "busy" | "failed" | string;
  channel_info?: { agent_phone_number?: string };
  duration?: number | null;
  interaction_id?: string | null;
  failure_reason?: string | null;
  final_agent_variables?: Record<string, unknown> | null;
  webhook_config?: { metadata?: Record<string, string> | null } | null;
  interaction_transcript?: SarvamCampaignWebhookPayload["interaction_transcript"];
}

/**
 * Converts an instant-outbound result into the campaign webhook shape, so a
 * callback call is recorded exactly like a campaign call (transcript, usage,
 * DNC, outcome), using the ids we attached as metadata when dialling.
 */
export function toCampaignPayload(
  payload: SarvamInstantOutboundPayload
): SarvamCampaignWebhookPayload | null {
  const metadata = payload.webhook_config?.metadata || {};
  if (!payload.attempt_id || !metadata.campaign_id || !metadata.user_phone_number) return null;

  return {
    attempt_id: payload.attempt_id,
    app_id: "instant-outbound",
    campaign_id: metadata.campaign_id,
    cohort_id: "callback",
    user_identifier: metadata.contact_id || null,
    user_phone_number: metadata.user_phone_number,
    agent_phone_number: payload.channel_info?.agent_phone_number || null,
    interaction_id: payload.interaction_id || null,
    completion_status: payload.status === "connected" ? "completed" : "failed",
    connectivity_status: payload.status || null,
    duration: payload.duration ?? null,
    failure_reason: payload.failure_reason || null,
    output_agent_variables: (payload.final_agent_variables || null) as SarvamCampaignWebhookPayload["output_agent_variables"],
    interaction_transcript: payload.interaction_transcript || null,
  };
}
