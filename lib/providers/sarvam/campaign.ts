import { sarvamFetch } from "./client";
import {
  getCampaignTtlDays,
  getDefaultAttemptsPerSecond,
  getSarvamScope,
  resolveAgentAppId,
  resolveAgentAppVersion,
  resolveConnectionId,
  schedulingPath,
} from "./config";
import { SarvamProviderError } from "./errors";
import { normalizeIndianPhone } from "@/lib/validation/phone";
import {
  SarvamAllowedSchedule,
  SarvamCampaignListResponse,
  SarvamCampaignRequest,
  SarvamCampaignResponse,
  SarvamCampaignStatusAction,
  SarvamCreateCampaignPayload,
  SarvamStatusUpdateRequest,
  SarvamStatusUpdateResponse,
} from "./types";

/** Database `calling_days` uses 1 = Monday … 7 = Sunday. */
const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const DEFAULT_START_TIME = "09:00";
const DEFAULT_END_TIME = "20:00";
// Sarvam rejects campaigns whose start_timestamp is less than 120 seconds in
// the future. Schedule with extra margin for clock skew and request latency.
const MIN_START_LEAD_MS = 3 * 60 * 1000;
const MAX_DESCRIPTION_LENGTH = 150;

function toHhMm(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return fallback;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (hours > 23 || minutes > 59) return fallback;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function toAllowedDays(days: number[] | undefined): string[] {
  const mapped = (days || [])
    .map((day) => DAY_NAMES[day - 1])
    .filter((name): name is (typeof DAY_NAMES)[number] => Boolean(name));

  return mapped.length > 0 ? Array.from(new Set(mapped)) : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
}

function toE164(value: string | null | undefined, label: string): string {
  const normalized = normalizeIndianPhone(value || "");
  if (!normalized.isValid || !normalized.normalized) {
    throw new SarvamProviderError(
      `Invalid Sarvam ${label} "${value || ""}". Use an E.164 number (e.g. +918041234567) or a 10-digit Indian number.`,
      "PHONE_CONFIGURATION_ERROR",
      400,
      null,
      false
    );
  }
  return normalized.normalized;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Maps the domain campaign request onto the current Sarvam scheduling API
 * payload. Exported so the mapping can be unit tested without network access.
 */
export function buildCreateCampaignPayload(
  params: SarvamCampaignRequest
): SarvamCreateCampaignPayload {
  const appId = resolveAgentAppId(params.app_id);
  const appVersion = resolveAgentAppVersion(params.app_version);
  const connectionId = resolveConnectionId(params.phone_number_id);

  const rawNumbers = [
    ...(params.caller_ids || []),
    ...(params.caller_id ? [params.caller_id] : []),
  ];
  if (rawNumbers.length === 0) {
    throw new SarvamProviderError(
      "A Sarvam dialer number is required. Set the business phone number with its Sarvam connection, or configure SARVAM_CONNECTION_ID.",
      "PHONE_CONFIGURATION_ERROR",
      400,
      null,
      false
    );
  }

  const phoneNumbers = Array.from(
    new Set(rawNumbers.map((number) => toE164(number, "dialer number")))
  );

  const maxRetries = clamp(Math.trunc(params.retry_policy?.max_attempts ?? 0), 0, 20);
  const retryEnabled = maxRetries > 0;
  const attemptsPerSecond = params.rate_limit_per_minute
    ? clamp(params.rate_limit_per_minute / 60, 0.1, 500)
    : getDefaultAttemptsPerSecond();

  const requestedStart = params.start_timestamp
    ? new Date(params.start_timestamp)
    : new Date();
  if (Number.isNaN(requestedStart.getTime())) {
    throw new SarvamProviderError(
      `Invalid campaign start timestamp "${params.start_timestamp}".`,
      "CAMPAIGN_CONFIGURATION_ERROR",
      400,
      null,
      false
    );
  }
  const earliestStart = Date.now() + MIN_START_LEAD_MS;
  const startTimestamp = new Date(Math.max(requestedStart.getTime(), earliestStart));

  const endTimestamp = params.end_timestamp
    ? new Date(params.end_timestamp)
    : new Date(startTimestamp.getTime() + getCampaignTtlDays() * 24 * 60 * 60 * 1000);
  if (Number.isNaN(endTimestamp.getTime()) || endTimestamp <= startTimestamp) {
    throw new SarvamProviderError(
      "Campaign end timestamp must be after the start timestamp.",
      "CAMPAIGN_CONFIGURATION_ERROR",
      400,
      null,
      false
    );
  }

  const allowedSchedule: SarvamAllowedSchedule = {
    allowed_start_time: toHhMm(params.schedule?.start_time, DEFAULT_START_TIME),
    allowed_end_time: toHhMm(params.schedule?.end_time, DEFAULT_END_TIME),
    allowed_days: toAllowedDays(params.schedule?.allowed_days),
    timezone: params.schedule?.timezone || "Asia/Kolkata",
  };

  const webhook = params.webhook || params.app_config?.webhook_config;
  const agentPhoneRotation =
    params.retry_policy?.enable_phone_rotation === true && phoneNumbers.length >= 2;

  const payload: SarvamCreateCampaignPayload = {
    name: params.name,
    app_config: {
      app_id: appId,
      app_type: "agent",
      app_version: appVersion,
      attempts_per_second: attemptsPerSecond,
      connection_configs: [
        {
          connection_id: connectionId,
          phone_numbers: phoneNumbers,
          weight: 1,
        },
      ],
      retry_config: retryEnabled
        ? {
            max_retries: maxRetries,
            retry_interval_minutes: Math.max(
              1,
              Math.trunc(params.retry_policy?.retry_interval_minutes ?? 60)
            ),
            retry_on: {
              busy: { enabled: true },
              no_answer: { enabled: true },
              failed: { enabled: true },
            },
          }
        : { max_retries: 0 },
    },
    start_timestamp: startTimestamp.toISOString(),
    end_timestamp: endTimestamp.toISOString(),
    allowed_schedule: allowedSchedule,
  };

  // Agent phone rotation is only accepted with two or more numbers in the pool.
  if (agentPhoneRotation) {
    payload.app_config.phone_rotation = { agent: true };
  }

  if (params.description) {
    payload.description = params.description.slice(0, MAX_DESCRIPTION_LENGTH);
  }

  if (webhook?.url) {
    const webhookConfig = {
      url: webhook.url,
      ...(webhook.metadata ? { metadata: webhook.metadata } : {}),
    };

    // The request schema documents webhook_config at the top level while the
    // webhook payload docs reference app_config.webhook_config. Default to the
    // documented request shape; opt into the nested shape if needed.
    if (process.env.SARVAM_WEBHOOK_CONFIG_IN_APP_CONFIG === "true") {
      payload.app_config.webhook_config = webhookConfig;
    } else {
      payload.webhook_config = webhookConfig;
    }
  }

  return payload;
}

/**
 * Creates a campaign on the Sarvam Voice Agents scheduling API.
 * Endpoint: POST /api/scheduling/v1/orgs/:org_id/workspaces/:workspace_id/campaigns
 */
export async function createSarvamCampaign(
  params: SarvamCampaignRequest
): Promise<SarvamCampaignResponse> {
  getSarvamScope();
  const payload = buildCreateCampaignPayload(params);

  return sarvamFetch<SarvamCampaignResponse>(schedulingPath(), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Applies a lifecycle action to an existing Sarvam campaign.
 * Endpoint: PUT /api/scheduling/v1/orgs/:org_id/workspaces/:workspace_id/campaigns/:campaign_id/status
 */
export async function updateSarvamCampaignStatus(
  sarvamCampaignId: string,
  action: SarvamCampaignStatusAction
): Promise<SarvamStatusUpdateResponse> {
  getSarvamScope();
  const payload: SarvamStatusUpdateRequest = { action };

  return sarvamFetch<SarvamStatusUpdateResponse>(
    schedulingPath(`/${encodeURIComponent(sarvamCampaignId)}/status`),
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
}

/**
 * Pauses an active Sarvam campaign.
 * In-progress calls conclude; no new outbound calls are initiated.
 */
export async function pauseSarvamCampaign(
  sarvamCampaignId: string
): Promise<SarvamStatusUpdateResponse> {
  return updateSarvamCampaignStatus(sarvamCampaignId, "pause");
}

/** Resumes a paused Sarvam campaign according to its configured schedule. */
export async function resumeSarvamCampaign(
  sarvamCampaignId: string
): Promise<SarvamStatusUpdateResponse> {
  return updateSarvamCampaignStatus(sarvamCampaignId, "resume");
}

/** Cancels a campaign. This is terminal and cannot be undone. */
export async function cancelSarvamCampaign(
  sarvamCampaignId: string
): Promise<SarvamStatusUpdateResponse> {
  return updateSarvamCampaignStatus(sarvamCampaignId, "cancel");
}

/**
 * Retrieves status and details of a Sarvam campaign.
 * Endpoint: GET /api/scheduling/v1/orgs/:org_id/workspaces/:workspace_id/campaigns/:campaign_id
 */
export async function getSarvamCampaign(
  sarvamCampaignId: string
): Promise<SarvamCampaignResponse> {
  getSarvamScope();

  return sarvamFetch<SarvamCampaignResponse>(
    schedulingPath(`/${encodeURIComponent(sarvamCampaignId)}`),
    {
      method: "GET",
      retryTransient: true,
    }
  );
}

/**
 * Lists campaigns in the configured workspace.
 * Endpoint: GET /api/scheduling/v1/orgs/:org_id/workspaces/:workspace_id/campaigns
 */
export async function listSarvamCampaigns(options?: {
  status?: string;
  limit?: number;
  search?: string;
}): Promise<SarvamCampaignListResponse> {
  getSarvamScope();

  const query = new URLSearchParams();
  if (options?.status) query.set("campaign_status", options.status);
  if (options?.limit) query.set("limit", String(clamp(options.limit, 1, 100)));
  if (options?.search) query.set("search", options.search);
  const suffix = query.toString() ? `?${query.toString()}` : "";

  return sarvamFetch<SarvamCampaignListResponse>(schedulingPath(suffix), {
    method: "GET",
    retryTransient: true,
  });
}
