import { timingSafeEqual } from "node:crypto";
import { verifyHmacSha256 } from "@/lib/security/webhook-signature";
import { isUsableSarvamValue } from "./config";
import { isSarvamMockMode } from "./client";

export type SarvamWebhookVerificationMethod = "hmac" | "token" | "mock" | "none";

export interface SarvamWebhookVerificationResult {
  valid: boolean;
  method: SarvamWebhookVerificationMethod;
  reason?: string;
}

function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function readSignature(headers: Headers): string | null {
  return (
    headers.get("x-sarvam-signature") ||
    headers.get("x-sarvam-webhook-signature") ||
    headers.get("x-signature") ||
    null
  );
}

export function getSarvamWebhookVerificationMethod(): SarvamWebhookVerificationMethod {
  if (isUsableSarvamValue(process.env.SARVAM_WEBHOOK_SECRET)) return "hmac";
  if (isUsableSarvamValue(process.env.SARVAM_WEBHOOK_TOKEN)) return "token";
  if (isSarvamMockMode() && process.env.NODE_ENV !== "production") return "mock";
  return "none";
}

/**
 * Verifies inbound Sarvam campaign webhooks.
 *
 * Sarvam does not document a signature header for campaign callbacks, so the
 * primary mechanism is a shared token carried in the registered webhook URL.
 * If a Sarvam-provided secret is configured, HMAC verification is enforced.
 */
export function verifySarvamWebhook(
  headers: Headers,
  rawBody: string,
  urlToken: string | null
): SarvamWebhookVerificationResult {
  const secret = process.env.SARVAM_WEBHOOK_SECRET?.trim();

  if (isUsableSarvamValue(secret)) {
    const signature = readSignature(headers);
    const valid = verifyHmacSha256(rawBody, signature, secret);
    return valid
      ? { valid: true, method: "hmac" }
      : { valid: false, method: "hmac", reason: "Invalid webhook signature." };
  }

  const token = process.env.SARVAM_WEBHOOK_TOKEN?.trim();
  if (isUsableSarvamValue(token)) {
    if (urlToken && safeEquals(urlToken, token)) {
      return { valid: true, method: "token" };
    }
    return {
      valid: false,
      method: "token",
      reason: "Invalid or missing webhook token.",
    };
  }

  if (isSarvamMockMode() && process.env.NODE_ENV !== "production") {
    return { valid: true, method: "mock" };
  }

  return {
    valid: false,
    method: "none",
    reason:
      "Sarvam webhook verification is not configured. Set SARVAM_WEBHOOK_TOKEN (or SARVAM_WEBHOOK_SECRET).",
  };
}
