import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertRateLimit } from "@/lib/security/rate-limiter";
import { getTrustedAppOrigin, isSupabaseAuthConfigured, AUTH_CONFIG_ERROR } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/session";

export async function POST(request: Request) {
  let body: { email?: string } = {};
  try {
    body = await request.json();
  } catch {
    // An authenticated user may omit the email body.
  }

  const user = await getCurrentUser();
  const email = (user?.email || body.email || "").trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = await assertRateLimit(`auth:verify-resend:${ip}:${email}`, 5, 5 / 3600);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many verification requests." }, { status: 429 });
  }

  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json({ error: AUTH_CONFIG_ERROR }, { status: 503 });
  }

  const origin = getTrustedAppOrigin();
  if (!origin) {
    return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  // Keep the response generic so the endpoint cannot enumerate accounts.
  if (error && !/not found|already|does not exist/i.test(error.message)) {
    return NextResponse.json({ error: "Unable to send verification email." }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
