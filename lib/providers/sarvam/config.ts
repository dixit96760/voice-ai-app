import { SarvamProviderError } from "./errors";

/**
 * Configuration resolver for the Sarvam Voice Agents scheduling API.
 *
 * Every campaign/cohort endpoint is org + workspace scoped:
 *   {base}/api/scheduling/v1/orgs/{org_id}/workspaces/{workspace_id}/campaigns
 *
 * Reference: https://docs.sarvam.ai/conversations/api/campaigns/create
 */

export const SARVAM_SCHEDULING_BASE_URL = "https://apps.sarvam.ai";
export const SARVAM_SCHEDULING_PREFIX = "/api/scheduling/v1";
export const SARVAM_WEBHOOK_PATH = "/api/webhooks/sarvam/campaign";

/** Placeholder values that must never be sent to the real API. */
const PLACEHOLDER_PATTERN = /^(default|mock|placeholder|example|changeme|your[-_])/i;

function readEnv(name: string): string {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

export function isUsableSarvamValue(value: string | null | undefined): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !PLACEHOLDER_PATTERN.test(value.trim())
  );
}

export function sarvamConfigError(missing: string[]): SarvamProviderError {
  return new SarvamProviderError(
    `Sarvam integration is not fully configured. Missing environment variable(s): ${missing.join(", ")}. See docs/sarvam-integration.md for setup instructions.`,
    "CAMPAIGN_CONFIGURATION_ERROR",
    500,
    { missing },
    false
  );
}

export function getSarvamBaseUrl(): string {
  const configured = readEnv("SARVAM_BASE_URL");
  if (!isUsableSarvamValue(configured)) return SARVAM_SCHEDULING_BASE_URL;
  return configured.replace(/\/+$/, "");
}

/**
 * Resolves the API key used for Voice Agents calls (apps.sarvam.ai).
 *
 * Voice Agents authenticates with an `X-API-Key` header and issues keys with a
 * different format from the Model API keys (`api-subscription-key` on
 * api.sarvam.ai). A dedicated variable is therefore preferred, with
 * SARVAM_API_KEY kept as a fallback for single-key setups.
 */
export function getSarvamVoiceAgentsApiKey(): string {
  const dedicated = readEnv("SARVAM_VOICE_AGENTS_API_KEY");
  if (isUsableSarvamValue(dedicated)) return dedicated;

  const generic = readEnv("SARVAM_API_KEY");
  if (isUsableSarvamValue(generic)) return generic;

  return "";
}

export interface SarvamSchedulingScope {
  orgId: string;
  workspaceId: string;
  baseUrl: string;
}

/** Resolves the org/workspace scope, failing loudly with the exact missing keys. */
export function getSarvamScope(): SarvamSchedulingScope {
  const orgId = readEnv("SARVAM_ORG_ID");
  const workspaceId = readEnv("SARVAM_WORKSPACE_ID");
  const missing: string[] = [];

  if (!isUsableSarvamValue(orgId)) missing.push("SARVAM_ORG_ID");
  if (!isUsableSarvamValue(workspaceId)) missing.push("SARVAM_WORKSPACE_ID");
  if (missing.length > 0) throw sarvamConfigError(missing);

  return { orgId, workspaceId, baseUrl: getSarvamBaseUrl() };
}

/** Builds an absolute scheduling API path for the current scope. */
export function schedulingPath(suffix = ""): string {
  const { orgId, workspaceId } = getSarvamScope();
  return `${SARVAM_SCHEDULING_PREFIX}/orgs/${encodeURIComponent(
    orgId
  )}/workspaces/${encodeURIComponent(workspaceId)}/campaigns${suffix}`;
}

/**
 * Resolves the Sarvam agent (`app_id`) that runs the campaign.
 * Campaign-level values win over the workspace-wide default.
 */
export function resolveAgentAppId(preferred?: string | null): string {
  const candidate = isUsableSarvamValue(preferred) ? preferred.trim() : readEnv("SARVAM_AGENT_APP_ID");
  if (!isUsableSarvamValue(candidate)) throw sarvamConfigError(["SARVAM_AGENT_APP_ID"]);
  return candidate;
}

/**
 * Resolves the committed agent version. Sarvam expects a positive integer
 * (e.g. `2`). Local records may hold `"v2"`, so digits are extracted.
 */
export function resolveAgentAppVersion(preferred?: string | number | null): number {
  const raw = [preferred, readEnv("SARVAM_AGENT_APP_VERSION")].find(
    (value) => value !== undefined && value !== null && String(value).trim() !== ""
  );

  if (raw === undefined) throw sarvamConfigError(["SARVAM_AGENT_APP_VERSION"]);

  const digits = String(raw).match(/\d+/);
  const version = digits ? Number.parseInt(digits[0], 10) : Number.NaN;

  if (!Number.isFinite(version) || version < 1) {
    throw new SarvamProviderError(
      `Invalid Sarvam agent app version "${String(raw)}". Expected a positive integer such as 1 or "v1".`,
      "CAMPAIGN_CONFIGURATION_ERROR",
      500,
      null,
      false
    );
  }

  return version;
}

/** Resolves the Sarvam telephony connection that owns the dialer numbers. */
export function resolveConnectionId(preferred?: string | null): string {
  const candidate = isUsableSarvamValue(preferred)
    ? preferred.trim()
    : readEnv("SARVAM_CONNECTION_ID");
  if (!isUsableSarvamValue(candidate)) throw sarvamConfigError(["SARVAM_CONNECTION_ID"]);
  return candidate;
}

/**
 * Dialer numbers owned by the Sarvam connection (E.164, comma separated).
 * These take precedence over locally stored business numbers, because only
 * numbers registered with the Sarvam telephony connection can be used to dial.
 */
export function getDefaultDialerNumbers(): string[] {
  return readEnv("SARVAM_DIALER_PHONE_NUMBERS")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

/** Outbound dial rate (dials per second) used when a campaign does not define one. */
export function getDefaultAttemptsPerSecond(): number {
  const parsed = Number.parseFloat(readEnv("SARVAM_ATTEMPTS_PER_SECOND"));
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.min(Math.max(parsed, 0.1), 500);
}

/** How long a created campaign stays open for dialing (days). */
export function getCampaignTtlDays(): number {
  const parsed = Number.parseInt(readEnv("SARVAM_CAMPAIGN_TTL_DAYS"), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 7;
  return Math.min(parsed, 30);
}

/**
 * Agent variable names that may be streamed in a cohort.
 * Sarvam rejects unknown `app_variables`, so this list must mirror the
 * variables configured on the agent used by the campaign.
 */
export function getCohortVariableAllowList(overrides?: string[]): string[] {
  const fromEnv = readEnv("SARVAM_COHORT_VARIABLES")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const source = overrides && overrides.length > 0 ? overrides : fromEnv;
  const list = (source.length > 0 ? source : ["customer_name"])
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(list));
}

export function getWebhookToken(): string | null {
  const token = readEnv("SARVAM_WEBHOOK_TOKEN");
  return isUsableSarvamValue(token) ? token : null;
}

/**
 * Sarvam campaign webhooks are not documented as signed, so the shared token
 * is carried in the registered URL. Returns the URL to register with Sarvam.
 */
export function buildCampaignWebhookUrl(): string {
  let appUrl = readEnv("NEXT_PUBLIC_APP_URL");
  if (!appUrl && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    appUrl = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  } else if (!appUrl && process.env.VERCEL_URL) {
    appUrl = `https://${process.env.VERCEL_URL}`;
  }
  if (!appUrl) {
    appUrl = "http://localhost:3000";
  }
  appUrl = appUrl.replace(/\/+$/, "");
  const url = new URL(`${appUrl}${SARVAM_WEBHOOK_PATH}`);
  const token = getWebhookToken();
  if (token) url.searchParams.set("token", token);
  return url.toString();
}

export type SarvamWebhookVerification = "hmac" | "token" | "none";

export interface SarvamConfigStatus {
  ready: boolean;
  mockMode: boolean;
  baseUrl: string;
  hasApiKey: boolean;
  /** "voice-agents" when a dedicated Voice Agents key is set. */
  apiKeySource: "voice-agents" | "shared" | "none";
  orgId: string | null;
  workspaceId: string | null;
  agentAppId: string | null;
  agentAppVersion: number | null;
  connectionId: string | null;
  dialerNumbers: string[];
  attemptsPerSecond: number;
  campaignTtlDays: number;
  cohortVariables: string[];
  webhookUrl: string;
  webhookVerification: SarvamWebhookVerification;
  missing: string[];
  hints: Record<string, string>;
}

const CONFIG_HINTS: Record<string, string> = {
  SARVAM_VOICE_AGENTS_API_KEY:
    "Voice Agents → Settings → API Key in the Voice Agents dashboard (indus.sarvam.ai). This is a different key from the Model API key.",
  SARVAM_API_KEY:
    "Create a key in Voice Agents → Settings → API Key (indus.sarvam.ai).",
  SARVAM_ORG_ID: "Your Sarvam organisation id from the Voice Agents dashboard.",
  SARVAM_WORKSPACE_ID: "The Voice Agents workspace that holds your agent.",
  SARVAM_AGENT_APP_ID:
    "Agent app id of a committed Sarvam agent (Deploy → your agent → app id).",
  SARVAM_AGENT_APP_VERSION: "Committed agent version, e.g. 1.",
  SARVAM_CONNECTION_ID:
    "Telephony connection id from Voice Agents → Phone Numbers → your connection.",
  SARVAM_WEBHOOK_TOKEN:
    "Random token appended to the campaign webhook URL so callbacks can be verified.",
};

/** Non-secret configuration snapshot, used by the integration diagnostics route. */
export function getSarvamConfigStatus(): SarvamConfigStatus {
  const orgId = readEnv("SARVAM_ORG_ID");
  const workspaceId = readEnv("SARVAM_WORKSPACE_ID");
  const agentAppId = readEnv("SARVAM_AGENT_APP_ID");
  const connectionId = readEnv("SARVAM_CONNECTION_ID");
  const hasVoiceAgentsKey = isUsableSarvamValue(readEnv("SARVAM_VOICE_AGENTS_API_KEY"));
  const hasGenericKey = isUsableSarvamValue(readEnv("SARVAM_API_KEY"));
  const hasApiKey = hasVoiceAgentsKey || hasGenericKey;
  const hasSecret = isUsableSarvamValue(readEnv("SARVAM_WEBHOOK_SECRET"));
  const hasToken = getWebhookToken() !== null;

  const missing: string[] = [];
  if (!hasVoiceAgentsKey) missing.push("SARVAM_VOICE_AGENTS_API_KEY");
  if (!isUsableSarvamValue(orgId)) missing.push("SARVAM_ORG_ID");
  if (!isUsableSarvamValue(workspaceId)) missing.push("SARVAM_WORKSPACE_ID");
  if (!isUsableSarvamValue(agentAppId)) missing.push("SARVAM_AGENT_APP_ID");
  if (!isUsableSarvamValue(readEnv("SARVAM_AGENT_APP_VERSION"))) {
    missing.push("SARVAM_AGENT_APP_VERSION");
  }
  if (!isUsableSarvamValue(connectionId)) missing.push("SARVAM_CONNECTION_ID");

  let agentAppVersion: number | null = null;
  try {
    agentAppVersion = resolveAgentAppVersion();
  } catch {
    agentAppVersion = null;
  }

  return {
    ready: missing.length === 0,
    mockMode: readEnv("SARVAM_MOCK_MODE") === "true",
    baseUrl: getSarvamBaseUrl(),
    hasApiKey,
    apiKeySource: hasVoiceAgentsKey ? "voice-agents" : hasGenericKey ? "shared" : "none",
    orgId: isUsableSarvamValue(orgId) ? orgId : null,
    workspaceId: isUsableSarvamValue(workspaceId) ? workspaceId : null,
    agentAppId: isUsableSarvamValue(agentAppId) ? agentAppId : null,
    agentAppVersion,
    connectionId: isUsableSarvamValue(connectionId) ? connectionId : null,
    dialerNumbers: getDefaultDialerNumbers(),
    attemptsPerSecond: getDefaultAttemptsPerSecond(),
    campaignTtlDays: getCampaignTtlDays(),
    cohortVariables: getCohortVariableAllowList(),
    webhookUrl: buildCampaignWebhookUrl(),
    webhookVerification: hasSecret ? "hmac" : hasToken ? "token" : "none",
    missing,
    hints: missing.reduce<Record<string, string>>((acc, key) => {
      acc[key] = CONFIG_HINTS[key] || "See docs/sarvam-integration.md.";
      return acc;
    }, {}),
  };
}
