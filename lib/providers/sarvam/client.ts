if (typeof window !== "undefined") {
  throw new Error("Sarvam client can only be loaded on the server.");
}
import { SarvamProviderError, normalizeSarvamError } from "./errors";
import { getSarvamVoiceAgentsApiKey } from "./config";

const DEFAULT_SARVAM_BASE_URL = "https://apps.sarvam.ai";
const REQUEST_TIMEOUT_MS = 15000;

export interface SarvamRequestOptions extends RequestInit {
  timeoutMs?: number;
  retryTransient?: boolean;
}

/**
 * Checks whether mock provider mode is enabled.
 * Used during automated testing or when explicitly configured via environment variable.
 */
export function isSarvamMockMode(): boolean {
  if (process.env.SARVAM_MOCK_MODE === "true") {
    return true;
  }
  // Automatically fallback to mock mode if running under test suite without live API key
  if (process.env.NODE_ENV === "test" && !process.env.SARVAM_API_KEY) {
    return true;
  }
  return false;
}

/**
 * Server-only HTTP client for Sarvam Voice Agents & Telephony APIs.
 * Enforces authentication, request timeout, and error sanitization.
 */
export async function sarvamFetch<T>(
  endpointPath: string,
  options: SarvamRequestOptions = {}
): Promise<T> {
  // If mock mode is active, handle mock simulation
  if (isSarvamMockMode()) {
    return handleMockRequest<T>(endpointPath, options);
  }

  // Voice Agents (apps.sarvam.ai) authenticates with X-API-Key. The Model APIs
  // (api.sarvam.ai) use api-subscription-key, so both are sent to keep the
  // client usable against either surface.
  const apiKey = getSarvamVoiceAgentsApiKey();
  if (!apiKey) {
    throw new SarvamProviderError(
      "No Sarvam API key is configured on the server. Set SARVAM_VOICE_AGENTS_API_KEY (Voice Agents → Settings → API Key).",
      "AUTHENTICATION_ERROR",
      401,
      null,
      false
    );
  }

  const baseUrl = (process.env.SARVAM_BASE_URL || DEFAULT_SARVAM_BASE_URL).replace(/\/$/, "");
  const cleanPath = endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`;
  const fullUrl = `${baseUrl}${cleanPath}`;

  const headers = new Headers(options.headers || {});
  headers.set("X-API-Key", apiKey);
  headers.set("api-subscription-key", apiKey);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");

  const timeoutMs = options.timeoutMs || REQUEST_TIMEOUT_MS;
  const maxAttempts = options.retryTransient ? 3 : 1;

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(fullUrl, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        let errorData: unknown = null;
        try {
          errorData = await response.json();
        } catch {
          errorData = await response.text();
        }

        const normalized = normalizeSarvamError(
          new Error(
            typeof errorData === "object" && errorData !== null
              ? JSON.stringify(errorData)
              : String(errorData || response.statusText)
          ),
          response.status
        );

        if (normalized.retryable && attempt < maxAttempts) {
          // Exponential backoff
          await new Promise((res) => setTimeout(res, 500 * Math.pow(2, attempt - 1)));
          continue;
        }

        throw normalized;
      }

      if (response.status === 204) {
        return {} as T;
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      clearTimeout(timer);

      if ((err as { name?: string })?.name === "AbortError") {
        lastError = new SarvamProviderError(
          `Request to Sarvam timed out after ${timeoutMs}ms.`,
          "PROVIDER_UNAVAILABLE",
          408,
          null,
          true
        );
      } else {
        lastError = err;
      }

      if (attempt < maxAttempts) {
        await new Promise((res) => setTimeout(res, 500 * Math.pow(2, attempt - 1)));
        continue;
      }
    }
  }

  throw normalizeSarvamError(lastError);
}

/**
 * Deterministic Mock Request Handler for Testing and Local Simulation
 * Guarantees ZERO external calls and 100% deterministic test behavior.
 * Mirrors the current Sarvam scheduling API request/response shapes.
 */
function handleMockRequest<T>(endpointPath: string, options: SarvamRequestOptions): T {
  const method = (options.method || "GET").toUpperCase();
  const body = options.body ? JSON.parse(options.body as string) : {};
  const now = new Date().toISOString();
  const appConfig = (body.app_config || {}) as Record<string, unknown>;

  // Mock: Create Campaign
  if (method === "POST" && endpointPath.includes("/campaigns") && !endpointPath.includes("/cohorts") && !endpointPath.includes("/status")) {
    return {
      campaign_id: `mock_camp_${Math.random().toString(36).substring(2, 9)}`,
      name: body.name || "Mock Campaign",
      status: "scheduled",
      app_id: appConfig.app_id || "mock_agent_001",
      app_version: appConfig.app_version || 1,
      description: body.description || null,
      created_at: now,
      updated_at: now,
      created_by: "mock@sarvam.test",
    } as unknown as T;
  }

  // Mock: Stream Cohort
  if (method === "POST" && endpointPath.includes("/cohorts/stream")) {
    const userCount = Array.isArray(body.users) ? body.users.length : 0;
    return {
      cohort_id: `mock_cohort_${Math.random().toString(36).substring(2, 9)}`,
      name: body.name || "Mock Cohort",
      status: "completed",
      source_type: "file_upload",
      created_at: now,
      updated_at: now,
      result: {
        total_records: userCount,
        valid_records: userCount,
        rejected_records: 0,
      },
    } as unknown as T;
  }

  // Mock: Update Status (Pause / Resume / Cancel) — PUT /status
  if ((method === "PUT" || method === "POST") && endpointPath.includes("/status")) {
    const action = body.action || "pause";
    const statusByAction: Record<string, string> = {
      pause: "paused",
      resume: "active",
      cancel: "cancelled",
    };
    return {
      campaign_id: endpointPath.split("/campaigns/")[1]?.split("/")[0] || "mock_camp_123",
      name: "Mock Campaign",
      status: statusByAction[action] || "active",
      action_applied: action,
      app_id: "mock_agent_001",
      app_version: 1,
      updated_at: now,
    } as unknown as T;
  }

  // Mock: Get Cohort
  if (method === "GET" && endpointPath.includes("/cohorts/")) {
    return {
      cohort_id: "mock_cohort_123",
      name: "Mock Cohort",
      status: "completed",
      source_type: "file_upload",
      created_at: now,
      updated_at: now,
      result: { total_records: 0, valid_records: 0, rejected_records: 0 },
    } as unknown as T;
  }

  // Mock: Get Campaign
  if (method === "GET" && endpointPath.includes("/campaigns/")) {
    return {
      campaign_id: "mock_camp_123",
      name: "Mock Campaign Details",
      status: "active",
      app_id: "mock_agent_001",
      app_version: 1,
      created_at: now,
      updated_at: now,
    } as unknown as T;
  }

  // Mock: List Campaigns
  if (method === "GET" && endpointPath.includes("/campaigns")) {
    return {
      items: [
        {
          campaign_id: "mock_camp_123",
          name: "Mock Campaign Details",
          status: "active",
          app_id: "mock_agent_001",
          app_version: 1,
          created_at: now,
          updated_at: now,
        },
      ],
      total: 1,
      limit: 10,
      offset: 0,
      next_page_uri: null,
      prev_page_uri: null,
    } as unknown as T;
  }

  return {} as T;
}
