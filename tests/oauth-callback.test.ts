/**
 * Tests for OAuth Callback handling logic (Google Workspace, Supabase Auth)
 */

interface OAuthCallbackParams {
  code: string | null;
  error: string | null;
  errorDescription: string | null;
  next: string | null;
  hasBusiness: boolean;
  exchangeSuccess: boolean;
}

export function evaluateOAuthCallback(params: OAuthCallbackParams): { destination: string } {
  const { code, error, errorDescription, next, hasBusiness, exchangeSuccess } = params;

  if (error) {
    const msg = encodeURIComponent(errorDescription || error || "Authentication cancelled");
    return { destination: `/login?error=${msg}` };
  }

  if (!code) {
    return { destination: "/login?error=Missing+authentication+code" };
  }

  if (!exchangeSuccess) {
    return { destination: "/login?error=Could+not+authenticate+user" };
  }

  if (next && next.startsWith("/")) {
    return { destination: next };
  }

  if (hasBusiness) {
    return { destination: "/dashboard" };
  }

  return { destination: "/onboarding" };
}

export function runOAuthCallbackTests() {
  console.log("Running Google OAuth Callback Flow Tests...");

  // 1. User cancels OAuth prompt
  const r1 = evaluateOAuthCallback({
    code: null,
    error: "access_denied",
    errorDescription: "The user denied access",
    next: null,
    hasBusiness: false,
    exchangeSuccess: false,
  });
  if (!r1.destination.includes("/login?error=")) {
    throw new Error("Expected redirect to /login with error query parameter");
  }
  console.log("  ✅ Test 1: User cancelled OAuth redirected to login with error");

  // 2. Missing authorization code
  const r2 = evaluateOAuthCallback({
    code: null,
    error: null,
    errorDescription: null,
    next: null,
    hasBusiness: false,
    exchangeSuccess: false,
  });
  if (r2.destination !== "/login?error=Missing+authentication+code") {
    throw new Error("Expected missing code redirect");
  }
  console.log("  ✅ Test 2: Missing authorization code rejected");

  // 3. Successful OAuth exchange for existing business owner
  const r3 = evaluateOAuthCallback({
    code: "valid-auth-code-123",
    error: null,
    errorDescription: null,
    next: null,
    hasBusiness: true,
    exchangeSuccess: true,
  });
  if (r3.destination !== "/dashboard") {
    throw new Error(`Expected redirect to /dashboard, got: ${r3.destination}`);
  }
  console.log("  ✅ Test 3: Existing business owner routed to /dashboard");

  // 4. Successful OAuth exchange for first-time user (no business yet)
  const r4 = evaluateOAuthCallback({
    code: "valid-auth-code-456",
    error: null,
    errorDescription: null,
    next: null,
    hasBusiness: false,
    exchangeSuccess: true,
  });
  if (r4.destination !== "/onboarding") {
    throw new Error(`Expected redirect to /onboarding, got: ${r4.destination}`);
  }
  console.log("  ✅ Test 4: First-time user routed to /onboarding");

  // 5. Specific next parameter (e.g. password recovery callback)
  const r5 = evaluateOAuthCallback({
    code: "valid-auth-code-789",
    error: null,
    errorDescription: null,
    next: "/settings/security",
    hasBusiness: true,
    exchangeSuccess: true,
  });
  if (r5.destination !== "/settings/security") {
    throw new Error(`Expected redirect to /settings/security, got: ${r5.destination}`);
  }
  console.log("  ✅ Test 5: Custom next redirect parameter honored");
}

if (require.main === module) {
  runOAuthCallbackTests();
}
