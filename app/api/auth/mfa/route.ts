import { NextResponse } from "next/server";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import { assertRateLimit } from "@/lib/security/rate-limiter";
import {
  challengeMfaFactor,
  enrollTotp,
  generateMfaRecoveryCodes,
  unenrollMfaFactor,
  verifyMfaFactor,
} from "@/lib/auth/mfa";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const profile = await getCurrentProfile();
  if (profile?.account_status && profile.account_status !== "ACTIVE") {
    return NextResponse.json({ error: "Account is not active." }, { status: 403 });
  }

  let body: {
    action?: "enroll" | "challenge" | "verify" | "unenroll" | "recovery_codes";
    friendlyName?: string;
    factorId?: string;
    challengeId?: string;
    code?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = await assertRateLimit(
    `auth:mfa:${user.id}:${ip}:${body.action || "unknown"}`,
    body.action === "verify" ? 10 : 30,
    body.action === "verify" ? 10 / 600 : 1
  );
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many MFA attempts." }, { status: 429 });
  }

  try {
    if (body.action === "enroll") {
      const result = await enrollTotp(body.friendlyName?.trim() || "Authenticator app");
      return NextResponse.json(result);
    }
    if (body.action === "challenge" && body.factorId) {
      const result = await challengeMfaFactor(body.factorId);
      return NextResponse.json(result);
    }
    if (body.action === "verify" && body.factorId && body.challengeId && body.code) {
      const result = await verifyMfaFactor(body.factorId, body.challengeId, body.code);
      return NextResponse.json(result);
    }
    if (body.action === "unenroll" && body.factorId) {
      const result = await unenrollMfaFactor(body.factorId);
      return NextResponse.json(result);
    }
    if (body.action === "recovery_codes") {
      const result = await generateMfaRecoveryCodes();
      return NextResponse.json(result);
    }
  } catch {
    return NextResponse.json({ error: "MFA operation failed." }, { status: 500 });
  }

  return NextResponse.json({ error: "Invalid MFA operation." }, { status: 400 });
}
