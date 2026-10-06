import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/auth/demo-mode";

function secureCookieOptions(options: CookieOptions): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: options.sameSite ?? "lax",
    path: options.path ?? "/",
  };
}

function redirectPreservingAuthCookies(
  response: NextResponse,
  url: URL
): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of response.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = response.headers.get(header);
    if (value) redirect.headers.set(header, value);
  }
  return redirect;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headersToSet) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set({
            name,
            value,
            ...secureCookieOptions(options),
          });
        }

        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set({
            name,
            value,
            ...secureCookieOptions(options),
          });
        }

        for (const [name, value] of Object.entries(headersToSet)) {
          response.headers.set(name, value);
        }
      },
    },
    cookieEncoding: "base64url",
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const recoveryMode = request.cookies.get("auth_recovery")?.value === "1";

  const isDashboardRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/campaigns") ||
    pathname.startsWith("/contacts") ||
    pathname.startsWith("/calls") ||
    pathname.startsWith("/callbacks") ||
    pathname.startsWith("/analytics") ||
    pathname.startsWith("/usage") ||
    pathname.startsWith("/billing") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/help");

  const isOnboardingRoute = pathname.startsWith("/onboarding");

  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/reset-password");
  const isApiRoute = pathname.startsWith("/api/");
  const hasApiKey = Boolean(
    request.headers.get("x-api-key") ||
      request.headers.get("authorization")?.toLowerCase().startsWith("bearer sv_live_")
  );

  // API-key principals are authenticated by the route-level verifier, which
  // checks the hash, expiry, revocation, and organization scope.
  if (isApiRoute && hasApiKey && !pathname.startsWith("/api/auth/")) {
    return response;
  }

  if (pathname === "/api/auth/demo") {
    return response;
  }

  if (
    isDemoMode() &&
    !user &&
    (isDashboardRoute || isOnboardingRoute || isAuthRoute) &&
    !request.nextUrl.searchParams.has("error")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/api/auth/demo";
    url.search = "";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return redirectPreservingAuthCookies(response, url);
  }

  // Rule 1: Unauthenticated user attempting protected or onboarding route -> redirect to /login
  if (!user) {
    if (
      pathname.startsWith("/api/auth/phone") ||
      pathname.startsWith("/api/auth/verify/resend")
    ) {
      return response;
    }

    if (isApiRoute) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    if (isDashboardRoute || isOnboardingRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectTo", pathname);
      return redirectPreservingAuthCookies(response, url);
    }
    return response;
  }

  let accountActive = true;
  try {
    const { data: isActive, error: accountError } = await supabase.rpc(
      "auth_user_is_active"
    );
    if (!accountError) accountActive = Boolean(isActive);
  } catch {
    // Keep compatibility with a database that has not applied the additive
    // account-state migration yet; server actions still verify the profile.
  }

  if (!accountActive) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Account is not active." }, { status: 403 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "Account is not active.");
    return redirectPreservingAuthCookies(response, url);
  }

  if (recoveryMode && isApiRoute) {
    return NextResponse.json(
      { error: "Password recovery is required before using the application." },
      { status: 403 }
    );
  }

  if (
    recoveryMode &&
    pathname !== "/update-password" &&
    !pathname.startsWith("/auth/")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/update-password";
    return redirectPreservingAuthCookies(response, url);
  }

  // Resolve an active organization/business through the membership-aware RPC.
  // Fall back to the legacy owner lookup while an older database is draining.
  let hasBusiness = false;
  try {
    const { data: businessIds, error: membershipError } = await supabase.rpc(
      "auth_user_business_ids"
    );

    if (!membershipError && Array.isArray(businessIds)) {
      hasBusiness = businessIds.length > 0;
    } else {
      const { data: business } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      hasBusiness = Boolean(business?.id);
    }
  } catch {
    hasBusiness = false;
  }

  const businessOptionalApiRoute =
    pathname.startsWith("/api/auth/verify/") ||
    pathname.startsWith("/api/auth/invitations/");

  if (isApiRoute && !hasBusiness && !businessOptionalApiRoute) {
    return NextResponse.json(
      { error: "An active business account is required." },
      { status: 403 }
    );
  }

  // Rule 2: Authenticated user attempting /onboarding
  if (isOnboardingRoute) {
    if (hasBusiness) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return redirectPreservingAuthCookies(response, url);
    }
    return response;
  }

  // Rule 3: Authenticated user attempting application routes without a business
  if (isDashboardRoute) {
    if (!hasBusiness) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return redirectPreservingAuthCookies(response, url);
    }
    return response;
  }

  // Rule 4: Authenticated user visiting auth pages (/login, /signup, etc.)
  if (isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = hasBusiness ? "/dashboard" : "/onboarding";
    return redirectPreservingAuthCookies(response, url);
  }

  return response;
}
