/**
 * Sarvam Voice Telephony Provider Type Definitions
 */

export type SarvamLanguageCode =
  | "hi-IN" // Hindi
  | "en-IN" // Indian English
  | "te-IN" // Telugu
  | "ta-IN" // Tamil
  | "kn-IN" // Kannada
  | "ml-IN" // Malayalam
  | "mr-IN" // Marathi
  | "bn-IN" // Bengali
  | "gu-IN" // Gujarati
  | "pa-IN"; // Punjabi

export interface SarvamAgentConfig {
  agent_name: string;
  prompt: string;
  language: SarvamLanguageCode;
  greeting?: string;
  temperature?: number;
  max_call_duration_seconds?: number;
  metadata?: Record<string, unknown>;
}

export interface SarvamAgentResponse {
  agent_id: string;
  agent_name: string;
  version_id?: string;
  status: string;
  created_at: string;
}

export interface SarvamCampaignConfig {
  campaign_name: string;
  agent_id: string;
  phone_number_id: string;
  scheduled_start?: string;
  scheduled_end?: string;
  concurrency_limit?: number;
  retry_attempts?: number;
  metadata?: Record<string, unknown>;
}

export interface SarvamCampaignResponse {
  campaign_id: string;
  campaign_name: string;
  status: "DRAFT" | "READY" | "RUNNING" | "PAUSED" | "COMPLETED";
  created_at: string;
}

export interface SarvamCallPayload {
  to_phone_number: string;
  from_phone_number?: string;
  agent_id: string;
  campaign_id?: string;
  contact_id?: string;
  custom_variables?: Record<string, string>;
}

export interface SarvamCallResponse {
  call_id: string;
  provider_interaction_id?: string;
  status: "QUEUED" | "INITIATED" | "RINGING" | "ANSWERED" | "COMPLETED" | "FAILED";
  timestamp: string;
}

export interface SarvamWebhookEvent {
  event_id: string;
  event_type:
    | "call.initiated"
    | "call.ringing"
    | "call.answered"
    | "call.ended"
    | "call.failed"
    | "transcript.ready"
    | "recording.ready";
  timestamp: string;
  call_id: string;
  campaign_id?: string;
  interaction_id?: string;
  payload: {
    duration_seconds?: number;
    hangup_reason?: string;
    transcript_url?: string;
    recording_url?: string;
    transcript_text?: string;
    metadata?: Record<string, unknown>;
  };
}

/**
 * Provider Abstraction Interface (VoiceProvider)
 * Guarantees that our application layer never couples tightly to any single provider.
 */
export interface VoiceProvider {
  name: string;
  createAgent(config: SarvamAgentConfig): Promise<SarvamAgentResponse>;
  createCampaign(config: SarvamCampaignConfig): Promise<SarvamCampaignResponse>;
  startCampaign(campaignId: string): Promise<boolean>;
  pauseCampaign(campaignId: string): Promise<boolean>;
  resumeCampaign(campaignId: string): Promise<boolean>;
  initiateCall(payload: SarvamCallPayload): Promise<SarvamCallResponse>;
  fetchTranscript(callId: string): Promise<string | null>;
  fetchRecordingSignedUrl(recordingId: string): Promise<string | null>;
  verifyWebhookSignature(headers: Headers, rawBody: string): boolean;
}
