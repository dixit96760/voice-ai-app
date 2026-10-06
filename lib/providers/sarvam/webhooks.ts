import { SarvamCampaignWebhookPayload, SarvamTranscriptTurn } from "./types";
import type { CallStatus, CallOutcome } from "@/lib/supabase/types";

export interface NormalizedCallAttempt {
  providerAttemptId: string;
  providerInteractionId: string | null;
  providerCampaignId: string;
  providerCohortId: string;
  providerUserIdentifier: string | null;
  agentPhoneNumber: string | null;
  userPhoneNumber: string;
  callStatus: CallStatus;
  callOutcome: CallOutcome | null;
  durationSeconds: number;
  failureReason: string | null;
  retryMetadata: Record<string, unknown>;
  nextActionStatus: string | null;
  transcriptText: string;
  transcriptJson: SarvamTranscriptTurn[];
  agentVariables: Record<string, unknown>;
  dncRequested: boolean;
  wrongNumber: boolean;
  callbackRequested: boolean;
  callbackDatetime: string | null;
  interestLevel: string | null;
  shortSummary: string;
  questionsAsked: string[];
  objections: string[];
  recommendedNextAction: string | null;
}

/**
 * Normalizes Sarvam outbound campaign webhook payload into domain entities.
 * Accepts both the current documented field names (`duration`, `retry_attempt`,
 * `user_identifier`) and the legacy aliases emitted by earlier sandbox builds.
 */
export function normalizeCampaignWebhook(
  payload: SarvamCampaignWebhookPayload
): NormalizedCallAttempt {
  const {
    attempt_id,
    interaction_id,
    campaign_id,
    cohort_id,
    user_identifier,
    user_id,
    agent_phone_number,
    user_phone_number,
    completion_status,
    connectivity_status,
    next_action_status,
    failure_reason,
  } = payload;

  // 1. Map Connectivity and Completion to CallStatus
  let callStatus: CallStatus = "COMPLETED";
  let callOutcome: CallOutcome | null = null;

  if (connectivity_status === "busy") {
    callStatus = "BUSY";
    callOutcome = "BUSY";
  } else if (connectivity_status === "no_answer") {
    callStatus = "NO_ANSWER";
    callOutcome = "NO_ANSWER";
  } else if (connectivity_status === "failed") {
    callStatus = "FAILED";
    callOutcome = "UNREACHABLE";
  } else if (connectivity_status === "connected") {
    if (completion_status === "failed") {
      callStatus = "FAILED";
    } else {
      callStatus = "COMPLETED";
    }
  }

  // 2. Extract Agent Variables
  const vars = payload.output_agent_variables || {};
  const dncRequested = vars.dnc_requested === true;
  const wrongNumber = vars.wrong_number === true;
  const callbackRequested = vars.callback_requested === true;
  const callbackDatetime = typeof vars.callback_datetime === "string" ? vars.callback_datetime : null;
  const interestLevel = typeof vars.interest_level === "string" ? vars.interest_level : null;
  const questionsAsked = Array.isArray(vars.customer_questions) ? vars.customer_questions : [];
  const objections = Array.isArray(vars.objections) ? vars.objections : [];
  const recommendedNextAction = typeof vars.next_action === "string" ? vars.next_action : null;

  // 3. Resolve Outcome Priority:
  // DNC > Wrong Number > Callback > Agent outcome variable > Connectivity outcome
  if (dncRequested) {
    callOutcome = "DO_NOT_CALL";
  } else if (wrongNumber) {
    callOutcome = "WRONG_NUMBER";
  } else if (callbackRequested) {
    callOutcome = "CALLBACK";
  } else if (vars.call_outcome) {
    const outcomeStr = String(vars.call_outcome).toUpperCase();
    if (
      [
        "INTERESTED",
        "NOT_INTERESTED",
        "CALLBACK",
        "NO_ANSWER",
        "BUSY",
        "UNREACHABLE",
        "WRONG_NUMBER",
        "DO_NOT_CALL",
        "INFORMATION_REQUESTED",
        "OTHER",
      ].includes(outcomeStr)
    ) {
      callOutcome = outcomeStr as CallOutcome;
    }
  }

  // 4. Format Transcript Text Preserving Indic + English
  const transcriptTurns = payload.interaction_transcript || [];
  const transcriptLines = transcriptTurns.map((turn) => {
    const speaker = turn.role === "agent" ? "Agent" : "User";
    const enText = turn.en_text || "";
    if (turn.indic_text && turn.indic_text.trim().length > 0 && turn.indic_text !== enText) {
      return `${speaker}: ${turn.indic_text} (${enText})`;
    }
    return `${speaker}: ${enText}`;
  });
  const transcriptText = transcriptLines.join("\n");

  // 5. Duration: `duration` is current, `duration_seconds` is the legacy alias.
  const rawDuration = payload.duration ?? payload.duration_seconds ?? 0;
  const durationSeconds =
    typeof rawDuration === "number" && Number.isFinite(rawDuration)
      ? Math.max(0, Math.round(rawDuration))
      : 0;

  // 6. Retry attempt: `retry_attempt` is current, `attempt_number` is legacy.
  const rawAttempt = payload.retry_attempt ?? payload.attempt_number ?? 0;
  const retryAttempt = Number.isFinite(rawAttempt) ? Math.max(0, Math.trunc(rawAttempt)) : 0;

  // 7. Short Summary
  const shortSummary =
    vars.notes ||
    (callOutcome
      ? `Call ${callOutcome.toLowerCase().replace(/_/g, " ")}. Duration: ${durationSeconds}s.`
      : `Attempt processed with status ${callStatus}.`);

  return {
    providerAttemptId: attempt_id,
    providerInteractionId: interaction_id || null,
    providerCampaignId: campaign_id,
    providerCohortId: cohort_id,
    providerUserIdentifier: user_identifier || user_id || null,
    agentPhoneNumber: agent_phone_number || null,
    userPhoneNumber: user_phone_number,
    callStatus,
    callOutcome,
    durationSeconds,
    failureReason:
      failure_reason || (connectivity_status === "failed" ? "Call failed to connect" : null),
    retryMetadata: {
      next_action_status: next_action_status || null,
      attempt_number: retryAttempt,
      retry_attempt: retryAttempt,
      executed_at: payload.executed_at || null,
      start_datetime: payload.start_datetime || null,
      end_datetime: payload.end_datetime || null,
    },
    nextActionStatus: next_action_status || null,
    transcriptText,
    transcriptJson: transcriptTurns,
    agentVariables: vars,
    dncRequested,
    wrongNumber,
    callbackRequested,
    callbackDatetime,
    interestLevel,
    shortSummary,
    questionsAsked,
    objections,
    recommendedNextAction,
  };
}
