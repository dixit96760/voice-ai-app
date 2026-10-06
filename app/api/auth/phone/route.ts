import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertRateLimit } from "@/lib/security/rate-limiter";
import { phoneOtpRequestSchema, phoneOtpVerifySchema } from "@/lib/validation/auth";
import { recordAuthSecurityEvent } from "@/lib/auth/audit";
import { AUTH_CONFIG_ERROR, isSupabaseAuthConfigured } from "@/lib/auth/config";
import { recordCurrentDevice } from "@/lib/auth/devices";

export const runtime = "nodejs";

function getClientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: Request) {
  let body: { action?: "request" | "verify"; phone?: string; otp?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const ip = getClientKey(request);
  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json({ error: AUTH_CONFIG_ERROR }, { status: 503 });
  }
  if (body.action === "request") {
    const validation = phoneOtpRequestSchema.safeParse({ phone: body.phone || "" });
    if (!validation.success) {
      return NextResponse.json({ error: "Enter a valid Indian mobile number." }, { status: 400 });
    }

    const rate = await assertRateLimit(
      `auth:phone-request:${ip}:${validation.data.phone}`,
      5,
      5 / 3600
    );
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many verification-code requests. Please try again later." },
        { status: 429, headers: { "Retry-After": Math.ceil(rate.retryAfterMs / 1000).toString() } }
      );
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      phone: validation.data.phone,
    });
    if (error) {
      await recordAuthSecurityEvent({
        eventType: "PHONE_OTP_REQUEST",
        outcome: "FAILURE",
        metadata: { reason: "PROVIDER_ERROR" },
      });
      return NextResponse.json({ error: "Unable to send a verification code." }, { status: 400 });
    }

    await recordAuthSecurityEvent({
      eventType: "PHONE_OTP_REQUEST",
      outcome: "SUCCESS",
    });
    return NextResponse.json({ success: true });
  }

  if (body.action === "verify") {
    const validation = phoneOtpVerifySchema.safeParse({
      phone: body.phone || "",
      otp: body.otp || "",
    });
    if (!validation.success) {
      return NextResponse.json({ error: "Enter a valid phone number and 6-digit code." }, { status: 400 });
    }

    const rate = await assertRateLimit(
      `auth:phone-verify:${ip}:${validation.data.phone}`,
      10,
      10 / 600
    );
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please request a new code." },
        { status: 429, headers: { "Retry-After": Math.ceil(rate.retryAfterMs / 1000).toString() } }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      phone: validation.data.phone,
      token: validation.data.otp,
      type: "sms",
    });
    if (error || !data.user) {
      await recordAuthSecurityEvent({
        eventType: "PHONE_OTP_VERIFY",
        outcome: "FAILURE",
      });
      return NextResponse.json({ error: "The verification code is invalid or expired." }, { status: 400 });
    }

    await recordAuthSecurityEvent({
      userId: data.user.id,
      eventType: "PHONE_OTP_VERIFY",
      outcome: "SUCCESS",
    });
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_status")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile?.account_status && profile.account_status !== "ACTIVE") {
      await supabase.auth.signOut({ scope: "global" });
      return NextResponse.json({ error: "Account is not active." }, { status: 403 });
    }

    await recordCurrentDevice(data.user.id);

    const { data: businessIds, error: businessError } = await supabase.rpc(
      "auth_user_business_ids"
    );
    let hasBusiness = !businessError && Array.isArray(businessIds) && businessIds.length > 0;
    if (businessError) {
      const { data: business } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_id", data.user.id)
        .maybeSingle();
      hasBusiness = Boolean(business?.id);
    }
    return NextResponse.json({ success: true, hasBusiness });
  }

  return NextResponse.json({ error: "Unsupported phone authentication action." }, { status: 400 });
}
