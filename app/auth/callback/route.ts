import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { ensureProfile, getCurrentBusiness } from "@/lib/auth/session";
import { recordCurrentDevice } from "@/lib/auth/devices";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { AUTH_CONFIG_ERROR, isSupabaseAuthConfigured } from "@/lib/auth/config";

const RECOVERY_COOKIE = "auth_recovery";

function redirectWithRecoveryState(url: string, recovery: boolean): NextResponse {
  const response = NextResponse.redirect(url);
  response.cookies.set({
    name: RECOVERY_COOKIE,
    value: recovery ? "1" : "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: recovery ? 15 * 60 : 0,
  });
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const next = getSafeRedirectPath(searchParams.get("next"));
  const recoveryRequested =
    searchParams.get("type") === "recovery" || next === "/update-password";

  if (!isSupabaseAuthConfigured()) {
    return redirectWithRecoveryState(
      `${origin}/login?error=${encodeURIComponent(AUTH_CONFIG_ERROR)}`,
      false
    );
  }

  if (error) {
    const message = encodeURIComponent(
      errorDescription || error || "Authentication cancelled or failed"
    );
    return redirectWithRecoveryState(`${origin}/login?error=${message}`, false);
  }

  if (!code) {
    return redirectWithRecoveryState(
      `${origin}/login?error=${encodeURIComponent("Missing authentication code")}`,
      false
    );
  }

  const supabase = await createClient();
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !data.user) {
    const message = encodeURIComponent(
      exchangeError?.message || "Could not authenticate user"
    );
    return redirectWithRecoveryState(`${origin}/login?error=${message}`, false);
  }

  await ensureProfile(data.user);
  const { data: profile } = await supabase
    .from("profiles")
    .select("account_status")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profile?.account_status && profile.account_status !== "ACTIVE") {
    await supabase.auth.signOut({ scope: "global" });
    return redirectWithRecoveryState(`${origin}/login?error=Account+is+not+active`, false);
  }
  await recordCurrentDevice(data.user.id);

  // Recovery sessions are deliberately isolated from the dashboard until the
  // password is changed. The short-lived HttpOnly flag is set only after the
  // server has exchanged the Supabase authorization code.
  if (recoveryRequested) {
    return redirectWithRecoveryState(`${origin}/update-password`, true);
  }

  if (next) {
    return redirectWithRecoveryState(`${origin}${next}`, false);
  }

  const business = await getCurrentBusiness();
  return redirectWithRecoveryState(
    `${origin}${business ? "/dashboard" : "/onboarding"}`,
    false
  );
}
