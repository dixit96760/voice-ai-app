import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { AUTH_CONFIG_ERROR, isSupabaseAuthConfigured } from "@/lib/auth/config";

const allowedTypes = new Set(["signup", "email_change", "invite", "magiclink", "recovery"]);
const RECOVERY_COOKIE = "auth_recovery";

function redirectWithState(url: string, recovery: boolean): NextResponse {
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
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = getSafeRedirectPath(searchParams.get("next"));
  const recovery = type === "recovery" || next === "/update-password";

  if (!isSupabaseAuthConfigured()) {
    return redirectWithState(`${origin}/login?error=${encodeURIComponent(AUTH_CONFIG_ERROR)}`, false);
  }

  if (!tokenHash || !type || !allowedTypes.has(type)) {
    return redirectWithState(`${origin}/login?error=Invalid+verification+link`, false);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as "signup" | "email_change" | "invite" | "magiclink" | "recovery",
  });

  if (error) {
    return redirectWithState(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
      false
    );
  }

  if (recovery) {
    return redirectWithState(`${origin}/update-password`, true);
  }

  return redirectWithState(
    next ? `${origin}${next}` : `${origin}/login?verified=1`,
    false
  );
}
