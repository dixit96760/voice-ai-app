/**
 * Unit tests verifying route protection and redirection logic rules.
 */

interface RouteDecisionInput {
  pathname: string;
  user: { id: string } | null;
  hasBusiness: boolean;
}

interface RouteDecisionResult {
  action: "ALLOW" | "REDIRECT";
  redirectTo?: string;
}

/**
 * Pure evaluation function mirroring the Supabase middleware logic.
 */
export function evaluateRouteAccess(input: RouteDecisionInput): RouteDecisionResult {
  const { pathname, user, hasBusiness } = input;

  const isDashboardRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/campaigns") ||
    pathname.startsWith("/contacts") ||
    pathname.startsWith("/calls") ||
    pathname.startsWith("/callbacks") ||
    pathname.startsWith("/analytics") ||
    pathname.startsWith("/usage") ||
    pathname.startsWith("/billing") ||
    pathname.startsWith("/settings");

  const isOnboardingRoute = pathname.startsWith("/onboarding");

  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/reset-password");

  // Rule 1: Unauthenticated user attempting protected route
  if (!user) {
    if (isDashboardRoute || isOnboardingRoute) {
      return { action: "REDIRECT", redirectTo: `/login?redirectTo=${encodeURIComponent(pathname)}` };
    }
    return { action: "ALLOW" };
  }

  // Rule 2: Authenticated user attempting /onboarding
  if (isOnboardingRoute) {
    if (hasBusiness) {
      return { action: "REDIRECT", redirectTo: "/dashboard" };
    }
    return { action: "ALLOW" };
  }

  // Rule 3: Authenticated user attempting dashboard route without business
  if (isDashboardRoute) {
    if (!hasBusiness) {
      return { action: "REDIRECT", redirectTo: "/onboarding" };
    }
    return { action: "ALLOW" };
  }

  // Rule 4: Authenticated user visiting auth pages
  if (isAuthRoute) {
    return { action: "REDIRECT", redirectTo: hasBusiness ? "/dashboard" : "/onboarding" };
  }

  return { action: "ALLOW" };
}

export function runRouteProtectionTests() {
  console.log("Running Route Protection & Redirection Logic Tests...");

  // 1. Unauthenticated visiting /dashboard
  const r1 = evaluateRouteAccess({
    pathname: "/dashboard",
    user: null,
    hasBusiness: false,
  });
  if (r1.action !== "REDIRECT" || !r1.redirectTo?.startsWith("/login")) {
    throw new Error(`Expected redirect to /login for unauthenticated dashboard visit, got: ${JSON.stringify(r1)}`);
  }
  console.log("  ✅ Test 1: Unauthenticated user redirected to /login");

  // 2. Unauthenticated visiting /onboarding
  const r2 = evaluateRouteAccess({
    pathname: "/onboarding",
    user: null,
    hasBusiness: false,
  });
  if (r2.action !== "REDIRECT" || !r2.redirectTo?.startsWith("/login")) {
    throw new Error(`Expected redirect to /login for unauthenticated onboarding visit, got: ${JSON.stringify(r2)}`);
  }
  console.log("  ✅ Test 2: Unauthenticated user on /onboarding redirected to /login");

  // 3. Authenticated without business visiting /dashboard
  const r3 = evaluateRouteAccess({
    pathname: "/dashboard",
    user: { id: "usr-1" },
    hasBusiness: false,
  });
  if (r3.action !== "REDIRECT" || r3.redirectTo !== "/onboarding") {
    throw new Error(`Expected redirect to /onboarding, got: ${JSON.stringify(r3)}`);
  }
  console.log("  ✅ Test 3: Authenticated user without business redirected to /onboarding");

  // 4. Authenticated without business visiting /onboarding
  const r4 = evaluateRouteAccess({
    pathname: "/onboarding",
    user: { id: "usr-1" },
    hasBusiness: false,
  });
  if (r4.action !== "ALLOW") {
    throw new Error(`Expected access allowed to /onboarding, got: ${JSON.stringify(r4)}`);
  }
  console.log("  ✅ Test 4: Authenticated user without business allowed on /onboarding");

  // 5. Authenticated with business visiting /onboarding
  const r5 = evaluateRouteAccess({
    pathname: "/onboarding",
    user: { id: "usr-1" },
    hasBusiness: true,
  });
  if (r5.action !== "REDIRECT" || r5.redirectTo !== "/dashboard") {
    throw new Error(`Expected redirect to /dashboard, got: ${JSON.stringify(r5)}`);
  }
  console.log("  ✅ Test 5: Authenticated user with business redirected away from /onboarding to /dashboard");

  // 6. Authenticated with business visiting /dashboard
  const r6 = evaluateRouteAccess({
    pathname: "/dashboard",
    user: { id: "usr-1" },
    hasBusiness: true,
  });
  if (r6.action !== "ALLOW") {
    throw new Error(`Expected access allowed to /dashboard, got: ${JSON.stringify(r6)}`);
  }
  console.log("  ✅ Test 6: Authenticated user with business allowed on /dashboard");

  // 7. Authenticated with business visiting /login
  const r7 = evaluateRouteAccess({
    pathname: "/login",
    user: { id: "usr-1" },
    hasBusiness: true,
  });
  if (r7.action !== "REDIRECT" || r7.redirectTo !== "/dashboard") {
    throw new Error(`Expected redirect to /dashboard, got: ${JSON.stringify(r7)}`);
  }
  console.log("  ✅ Test 7: Authenticated user visiting /login redirected to /dashboard");
}

if (require.main === module) {
  runRouteProtectionTests();
}
