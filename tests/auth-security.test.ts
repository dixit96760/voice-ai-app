import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { getSafeRedirectPath } from "../lib/auth/redirect";
import {
  hasMinimumRole,
  hasPermission,
} from "../lib/permissions";
import {
  createApiKeyMaterial,
  verifyApiKey,
} from "../lib/auth/api-key";
import { verifyHmacSha256 } from "../lib/security/webhook-signature";
import { passwordSchema } from "../lib/validation/auth";

export async function runAuthSecurityTests(): Promise<void> {
  console.log("Running additive auth/security tests...");

  assert.equal(getSafeRedirectPath("/dashboard/campaigns?tab=active"), "/dashboard/campaigns?tab=active");
  assert.equal(getSafeRedirectPath("//evil.example"), "");
  assert.equal(getSafeRedirectPath("/\\evil.example"), "");
  assert.equal(getSafeRedirectPath("https://evil.example"), "");
  assert.equal(getSafeRedirectPath("/api/webhooks/razorpay"), "");

  assert.equal(hasPermission("OWNER", "billing:manage"), true);
  assert.equal(hasPermission("ADMIN", "billing:manage"), false);
  assert.equal(hasPermission("MEMBER", "campaigns:write"), true);
  assert.equal(hasPermission("VIEWER", "campaigns:write"), false);
  assert.equal(hasMinimumRole("ADMIN", "MEMBER"), true);
  assert.equal(hasMinimumRole("VIEWER", "MEMBER"), false);

  const previousPepper = process.env.AUTH_API_KEY_PEPPER;
  process.env.AUTH_API_KEY_PEPPER = "test-pepper-that-is-long-enough-for-auth-keys";
  const material = createApiKeyMaterial();
  assert.equal(verifyApiKey(material.rawKey, material.keyHash), true);
  assert.equal(verifyApiKey(`${material.rawKey}tampered`, material.keyHash), false);
  assert.equal(material.rawKey.startsWith("sv_live_"), true);
  if (previousPepper === undefined) delete process.env.AUTH_API_KEY_PEPPER;
  else process.env.AUTH_API_KEY_PEPPER = previousPepper;

  const rawBody = JSON.stringify({ attempt_id: "attempt-1" });
  const secret = "webhook-test-secret";
  const signature = createHmac("sha256", secret).update(rawBody).digest("hex");
  assert.equal(verifyHmacSha256(rawBody, signature, secret), true);
  assert.equal(verifyHmacSha256(`${rawBody}tampered`, signature, secret), false);

  assert.equal(passwordSchema.safeParse("short").success, false);
  assert.equal(passwordSchema.safeParse("long-enough-password").success, true);

  console.log("  ✅ Additive auth/security tests passed.");
}
