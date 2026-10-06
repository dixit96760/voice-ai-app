import { SarvamErrorCode } from "./types";

/**
 * Normalized Sarvam Provider Error
 * Encapsulates provider error states with safe user messages.
 */
export class SarvamProviderError extends Error {
  public readonly code: SarvamErrorCode;
  public readonly statusCode?: number;
  public readonly providerDetails?: unknown;
  public readonly retryable: boolean;

  constructor(
    message: string,
    code: SarvamErrorCode = "UNKNOWN_PROVIDER_ERROR",
    statusCode?: number,
    providerDetails?: unknown,
    retryable = false
  ) {
    super(message);
    this.name = "SarvamProviderError";
    this.code = code;
    this.statusCode = statusCode;
    this.providerDetails = providerDetails;
    this.retryable = retryable;
  }
}

/** Strips anything key-shaped and bounds the length of provider text. */
export function sanitizeProviderText(value: string): string {
  return value
    .replace(
      /\b(sk|sv|sv_live|sv_test)_[A-Za-z0-9_-]+/g,
      "[REDACTED_KEY]"
    )
    .replace(
      /(api-subscription-key|x-api-key|authorization|bearer)\s*[:=]?\s*\S+/gi,
      "$1: [REDACTED]"
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/**
 * Pulls the most useful human-readable string out of a provider error body.
 * Sarvam nests details as `{ error: { message, data: { details } } }`.
 */
export function extractProviderMessage(raw: unknown): string {
  const asString = typeof raw === "string" ? raw : "";
  let value: unknown = raw;

  if (asString) {
    try {
      value = JSON.parse(asString);
    } catch {
      return sanitizeProviderText(asString);
    }
  }

  if (!value || typeof value !== "object") {
    return asString ? sanitizeProviderText(asString) : "";
  }

  const record = value as Record<string, unknown>;
  const errorNode = (record.error ?? record) as Record<string, unknown>;
  const dataNode = errorNode?.data as Record<string, unknown> | undefined;

  const candidate =
    (dataNode?.details as string) ||
    (dataNode?.message as string) ||
    (errorNode?.message as string) ||
    (errorNode?.detail as string) ||
    (record.message as string) ||
    (record.detail as string) ||
    "";

  return typeof candidate === "string" ? sanitizeProviderText(candidate) : "";
}

/**
 * Categorizes an HTTP response or unexpected failure into a normalized SarvamErrorCode.
 */
export function normalizeSarvamError(
  error: unknown,
  statusCode?: number
): SarvamProviderError {
  if (error instanceof SarvamProviderError) {
    return error;
  }

  const status = statusCode || (error as { status?: number })?.status;
  const rawMsg =
    (error as { message?: string })?.message || "Unknown error communicating with Sarvam AI.";

  // Never expose raw API keys or internal tokens in message
  const sanitizedMsg = sanitizeProviderText(rawMsg);
  const providerMessage = extractProviderMessage(rawMsg);

  if (status === 401 || status === 403) {
    // Keep the provider reason (e.g. "Invalid API key format" vs a scope
    // problem) so operators can tell configuration mistakes apart.
    return new SarvamProviderError(
      providerMessage
        ? `Invalid or unauthorized Sarvam API key. Please check your provider configuration. (Sarvam: ${providerMessage})`
        : "Invalid or unauthorized Sarvam API key. Please check your provider configuration.",
      "AUTHENTICATION_ERROR",
      status,
      providerMessage || null,
      false
    );
  }

  if (status === 429) {
    return new SarvamProviderError(
      providerMessage
        ? `Sarvam API rate limit reached. Please wait before retrying. (Sarvam: ${providerMessage})`
        : "Sarvam API rate limit reached. Please wait before retrying.",
      "RATE_LIMIT",
      status,
      providerMessage || null,
      true
    );
  }

  if (status === 400 || status === 422) {
    return new SarvamProviderError(
      providerMessage
        ? `Invalid request payload: ${providerMessage}`
        : `Invalid request payload: ${sanitizedMsg}`,
      "INVALID_REQUEST",
      status,
      providerMessage || null,
      false
    );
  }

  if (status && status >= 500 && status < 600) {
    return new SarvamProviderError(
      "Sarvam Voice telephony service is temporarily unavailable. Please try again later.",
      "PROVIDER_UNAVAILABLE",
      status,
      providerMessage || null,
      true
    );
  }

  return new SarvamProviderError(
    `Sarvam provider error: ${providerMessage || sanitizedMsg}`,
    "UNKNOWN_PROVIDER_ERROR",
    status,
    providerMessage || null,
    false
  );
}
