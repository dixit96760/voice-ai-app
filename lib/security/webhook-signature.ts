import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export function sha256Hex(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function verifyHmacSha256(
  rawBody: string | Buffer,
  signature: string | null | undefined,
  secret: string | null | undefined
): boolean {
  if (!rawBody || !signature || !secret) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const received = /^[0-9a-f]+$/i.test(signature.trim())
    ? Buffer.from(signature.trim(), "hex")
    : Buffer.from(signature.trim(), "base64url");

  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function getTrustedWebhookSecret(
  configured: string | undefined,
  allowDevelopmentMock = false
): string | null {
  if (configured && !/mock|placeholder|your-/i.test(configured)) return configured;
  if (
    allowDevelopmentMock &&
    process.env.NODE_ENV !== "production" &&
    process.env.SARVAM_MOCK_MODE === "true"
  ) {
    return null;
  }
  return null;
}
