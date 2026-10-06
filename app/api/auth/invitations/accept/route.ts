import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { recordAuthSecurityEvent } from "@/lib/auth/audit";
import { assertRateLimit } from "@/lib/security/rate-limiter";

function hashInviteToken(token: string): string {
  const pepper = process.env.AUTH_API_KEY_PEPPER || process.env.SUPABASE_SERVICE_ROLE_KEY || "local-only";
  return createHash("sha256").update(`${pepper}:${token}`).digest("hex");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const token = body.token?.trim();
  if (!token) return NextResponse.json({ error: "Invitation token is required." }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = await assertRateLimit(`auth:invitation-accept:${ip}`, 20, 20 / 3600);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many invitation attempts." }, { status: 429 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("accept_organization_invitation", {
    p_token_hash: hashInviteToken(token),
    p_user_id: user.id,
  });

  if (error) {
    return NextResponse.json({ error: "Unable to accept invitation." }, { status: 500 });
  }

  const result = (data || {}) as Record<string, unknown>;
  if (!result.success) {
    const code = result.error_code;
    if (code === "INVITATION_EMAIL_MISMATCH") {
      return NextResponse.json(
        { error: "This invitation belongs to a different email address." },
        { status: 403 }
      );
    }
    if (code === "INVITATION_EXPIRED") {
      return NextResponse.json({ error: "Invitation has expired." }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Invitation is invalid or already used." },
      { status: 400 }
    );
  }

  await recordAuthSecurityEvent({
    userId: user.id,
    organizationId: typeof result.organization_id === "string" ? result.organization_id : null,
    eventType: "ORGANIZATION_INVITATION_ACCEPTED",
    outcome: "SUCCESS",
  });

  return NextResponse.json({ success: true, organizationId: result.organization_id });
}
