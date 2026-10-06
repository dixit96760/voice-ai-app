/**
 * Sarvam Voice Agents & Telephony Provider Type Definitions
 * Source of Truth: Current Sarvam Voice Agents Documentation (https://docs.sarvam.ai/)
 */

export interface SarvamAgentConfig {
  app_id?: string;
  app_version?: string;
  name: string;
  system_prompt: string;
  language: string;
  additional_languages?: string[];
  voice_id: string;
  speech_rate?: number;
  temperature?: number;
  tone?: string;
  output_variables_schema?: Record<string, unknown>;
}

export interface SarvamCampaignSchedule {
  start_time: string; // "HH:MM" or "HH:MM:SS"
  end_time: string;
  allowed_days: number[]; // e.g. [1, 2, 3, 4, 5, 6] (Mon-Sat)
  timezone: string; // e.g. "Asia/Kolkata"
}

export interface SarvamRetryPolicy {
  max_attempts: number;
  retry_interval_minutes: number;
  enable_phone_rotation?: boolean;
}

/**
 * Domain-level campaign launch request.
 * The provider maps this to the Sarvam scheduling API wire payload
 * (see `SarvamCreateCampaignPayload`).
 */
export interface SarvamCampaignRequest {
  name: string;
  /** Sarvam agent app id. Falls back to SARVAM_AGENT_APP_ID. */
  app_id?: string;
  app_type?: "agent";
  /** Committed agent version. Accepts `2` or `"v2"`. Falls back to env. */
  app_version?: string | number;
  /** Sarvam telephony connection id. Falls back to SARVAM_CONNECTION_ID. */
  phone_number_id?: string;
  /** Primary dialer number (E.164 preferred). */
  caller_id?: string;
  /** Additional dialer numbers, used for agent phone rotation. */
  caller_ids?: string[];
  schedule: SarvamCampaignSchedule;
  retry_policy: SarvamRetryPolicy;
  rate_limit_per_minute?: number;
  max_call_duration_seconds?: number;
  description?: string;
  /** Optional explicit campaign window; defaults to now → now + TTL. */
  start_timestamp?: string;
  end_timestamp?: string;
  webhook?: {
    url: string;
    metadata?: Record<string, string>;
  };
  /** Agent variable names allowed in the streamed cohort. */
  appVariables?: string[];
  app_config?: {
    webhook_config?: {
      url: string;
      metadata?: Record<string, string>;
      events?: string[];
    };
  };
}

/* ------------------------------------------------------------------ *
 * Sarvam scheduling API wire types
 * Reference: https://docs.sarvam.ai/conversations/api/campaigns/create
 * ------------------------------------------------------------------ */

export interface SarvamConnectionConfig {
  connection_id: string;
  phone_numbers: string[];
  weight?: number;
}

export interface SarvamRetryCondition {
  enabled: boolean;
  threshold_seconds?: number;
  max_retries?: number;
  retry_interval_minutes?: number;
}

export interface SarvamRetryConfig {
  /** 0-20. */
  max_retries: number;
  retry_interval_minutes?: number | number[];
  retry_on?: {
    busy?: SarvamRetryCondition;
    no_answer?: SarvamRetryCondition;
    failed?: SarvamRetryCondition;
    short_duration?: SarvamRetryCondition;
  };
}

export interface SarvamCampaignAgentConfig {
  app_id: string;
  app_type?: "agent";
  app_version: number;
  /** Dials per second, 0.1-500. */
  attempts_per_second: number;
  connection_configs: SarvamConnectionConfig[];
  retry_config: SarvamRetryConfig;
  /** Requires at least two numbers across connection_configs. */
  phone_rotation?: { agent: boolean };
  webhook_config?: SarvamWebhookConfig;
}

export interface SarvamWebhookConfig {
  url: string;
  metadata?: Record<string, unknown> | null;
}

export interface SarvamAllowedSchedule {
  /** HH:MM, 24-hour. */
  allowed_start_time: string;
  allowed_end_time: string;
  allowed_days: string[];
  timezone?: string;
}

export interface SarvamCreateCampaignPayload {
  name: string;
  app_config: SarvamCampaignAgentConfig;
  /** ISO 8601. */
  start_timestamp: string;
  end_timestamp: string;
  allowed_schedule: SarvamAllowedSchedule;
  description?: string;
  webhook_config?: SarvamWebhookConfig;
}

export type SarvamCampaignStatus =
  | "scheduled"
  | "active"
  | "paused"
  | "ended"
  | "cancelled";

export interface SarvamCampaignResponse {
  campaign_id: string;
  name: string;
  status: SarvamCampaignStatus | string;
  app_id: string;
  app_version?: number | null;
  description?: string | null;
  created_at: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string | null;
}

/**
 * Cohort user record.
 * `app_variables` keys must exist on the agent configured for the campaign,
 * otherwise Sarvam rejects the whole cohort.
 */
export interface SarvamCohortUser {
  user_phone_number: string; // E.164, e.g. "+919849012345"
  user_identifier?: string | null;
  app_variables?: Record<string, string>;
  /** Only initial_language_name, initial_state_name, initial_bot_message. */
  app_overrides?: Record<string, string>;
}

export interface SarvamStreamCohortRequest {
  name: string; // 1-50 characters
  users: SarvamCohortUser[]; // Up to 1,000 per request
}

export interface SarvamCohortResult {
  total_records: number;
  valid_records: number;
  rejected_records: number;
}

export interface SarvamCohortResponse {
  cohort_id: string;
  name: string;
  status: "processing" | "completed" | "failed" | string;
  source_type?: string;
  created_at: string;
  updated_at?: string;
  result?: SarvamCohortResult | null;
}

export type SarvamStreamCohortResponse = SarvamCohortResponse;

export interface SarvamCampaignListResponse {
  items: SarvamCampaignResponse[];
  total: number;
  limit: number;
  offset: number;
  next_page_uri?: string | null;
  prev_page_uri?: string | null;
}

export type SarvamCampaignStatusAction = "pause" | "resume" | "cancel";

export interface SarvamStatusUpdateRequest {
  action: SarvamCampaignStatusAction;
}

export interface SarvamStatusUpdateResponse {
  campaign_id: string;
  name?: string;
  status: SarvamCampaignStatus | string;
  app_id?: string;
  app_version?: number | null;
  action_applied?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Sarvam Interaction Transcript Turn
 */
export interface SarvamTranscriptTurn {
  role: "agent" | "user" | string;
  en_text: string;
  indic_text?: string;
  start_timestamp?: number;
  end_timestamp?: number;
}

/**
 * Sarvam Output Agent Variables
 */
export interface SarvamAgentVariables {
  call_outcome?: string;
  interest_level?: "HIGH" | "MEDIUM" | "LOW" | "NONE" | string;
  callback_requested?: boolean;
  callback_datetime?: string;
  dnc_requested?: boolean;
  wrong_number?: boolean;
  customer_name?: string;
  customer_questions?: string[];
  customer_requirements?: string[];
  objections?: string[];
  next_action?: string;
  notes?: string;
  [key: string]: unknown;
}

/**
 * Sarvam Campaign Call Attempt Webhook Payload
 * Dispatched by Sarvam after each campaign call attempt completes.
 * Reference: https://docs.sarvam.ai/conversations/api/campaigns/webhooks/webhook-payload
 */
export interface SarvamCampaignWebhookPayload {
  app_id: string;
  app_version?: number | string;
  campaign_id: string;
  cohort_id: string;
  attempt_id: string; // Unique call attempt identifier
  interaction_id?: string | null; // Null when the call did not connect
  /** Identifier we sent as cohort `user_identifier` (our contact id). */
  user_identifier?: string | null;
  /** Legacy alias for user_identifier. */
  user_id?: string | null;
  user_phone_number: string;
  /** Number used by the agent for this attempt. */
  agent_phone_number?: string | null;
  /** 0 = first attempt, 1 = first retry. */
  retry_attempt?: number;
  /** Legacy alias for retry_attempt. */
  attempt_number?: number;
  completion_status: "completed" | "partial" | "failed" | string;
  connectivity_status: "connected" | "busy" | "no_answer" | "failed" | null | string;
  next_action_status?:
    | "retry"
    | "reschedule"
    | "business_retry"
    | "short_duration_retry"
    | "provider_error_retry"
    | "internal_error_retry"
    | "none"
    | null
    | string;
  executed_at?: string | null;
  start_datetime?: string | null;
  end_datetime?: string | null;
  timestamps?: {
    initiated_at?: string;
    connected_at?: string;
    ended_at?: string;
  };
  /** Call duration in seconds. Null when the call did not connect. */
  duration?: number | null;
  /** Legacy alias for duration. */
  duration_seconds?: number | null;
  initial_agent_variables?: Record<string, unknown> | null;
  final_agent_variables?: Record<string, unknown> | null;
  output_agent_variables?: SarvamAgentVariables | null;
  interaction_transcript?: SarvamTranscriptTurn[] | null;
  recording_url?: string | null;
  metadata?: Record<string, unknown> | null;
  failure_reason?: string | null;
}

export type SarvamErrorCode =
  | "AUTHENTICATION_ERROR"
  | "RATE_LIMIT"
  | "INVALID_REQUEST"
  | "PROVIDER_UNAVAILABLE"
  | "PHONE_CONFIGURATION_ERROR"
  | "CAMPAIGN_CONFIGURATION_ERROR"
  | "COHORT_ERROR"
  | "UNKNOWN_PROVIDER_ERROR";
