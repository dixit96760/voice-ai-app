import { runAuthValidationTests } from "./auth-validation.test";
import { runPhoneOtpTests } from "./phone-otp.test";
import { runRouteProtectionTests } from "./route-protection.test";
import { runOAuthCallbackTests } from "./oauth-callback.test";
import { runBusinessOnboardingTests } from "./business-onboarding.test";
import { runCampaignManagementTests } from "./campaign-management.test";
import { runSarvamTelephonyTests } from "./sarvam-telephony.test";
import { runSarvamWebhookIdempotencyTests } from "./sarvam-webhook-idempotency.test";
import { runOperationalLayerTests } from "./operational-layer.test";
import { runBillingSubscriptionTests } from "./billing-subscriptions.test";
import { runAuthSecurityTests } from "./auth-security.test";
import { runEndToEndUserJourneyTests } from "./e2e-user-journey.test";
import { normalizeIndianPhone } from "../lib/validation/phone";

async function runAllTests() {
  console.log("==================================================");
  console.log("RUNNING COMPLETE SAAS TEST SUITE (PHASES 1 TO 4)");
  console.log("==================================================\n");

  // 1. Phone normalization
  console.log("1. Phone Normalization Tests...");
  const p1 = normalizeIndianPhone("9849012345");
  if (!p1.isValid || p1.normalized !== "+919849012345") {
    throw new Error("Phone normalization test failed");
  }
  const p2 = normalizeIndianPhone("09849012345");
  if (!p2.isValid || p2.normalized !== "+919849012345") {
    throw new Error("Trunk 0 phone normalization test failed");
  }
  console.log("  ✅ Phone normalization tests passed.\n");

  // 2. Auth validation
  runAuthValidationTests();
  console.log("");

  // 3. Phone OTP
  runPhoneOtpTests();
  console.log("");

  // 4. Route protection
  runRouteProtectionTests();
  console.log("");

  // 5. OAuth callback
  runOAuthCallbackTests();
  console.log("");

  // 6. Business onboarding & security
  runBusinessOnboardingTests();
  console.log("");

  console.log("==================================================");
  console.log("ALL 14 PHASE 2 TEST SCENARIOS PASSED SUCCESSFULLY!");
  console.log("==================================================\n");

  // 7. Additive auth/security primitives
  await runAuthSecurityTests();
  console.log("");

  // 8. Campaign Builder & Management (Phase 3)
  runCampaignManagementTests();
  console.log("");

  console.log("==================================================");
  console.log("ALL 16 PHASE 3 TEST SCENARIOS PASSED SUCCESSFULLY!");
  console.log("==================================================\n");

  // 8. Sarvam Voice Agents & Outbound Telephony (Phase 4)
  runSarvamTelephonyTests();
  console.log("");

  await runSarvamWebhookIdempotencyTests();
  console.log("");

  // 9. Operational Product Layer (Phase 5)
  runOperationalLayerTests();
  console.log("");

  // 10. Billing, Subscriptions & Production Hardening (Phase 6)
  await runBillingSubscriptionTests();
  console.log("");

  // 11. End-to-End User Journey Simulation (Phase 7)
  await runEndToEndUserJourneyTests();

  console.log("==================================================");
  console.log("🎉 ALL PHASE 1, 2, 3, 4, 5, 6 & 7 TEST SCENARIOS PASSED! 🎉");
  console.log("==================================================");
}

runAllTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
