import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAuthSecurityEvent } from "@/lib/auth/audit";

function canAdminister(role: string): boolean {
  return role === "OWNER" || role === "ADMIN";
}

function hashInviteToken(token: string): string {
  const pepper = process.env.AUTH_API_KEY_PEPPER || process.env.SUPABASE_SERVICE_ROLE_KEY || "local-only";
  return createHash("sha256").update(`${pepper}:${token}`).digest("hex");
}

export async function GET() {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const supabase = await createClient();
  const { data: organization } = await supabase
    .from("organizations")
    .select("id")
    .eq("business_id", context.business.id)
    .maybeSingle();

  if (!organization) return NextResponse.json({ data: [] });

  const { data, error } = await supabase
    .from("organization_members")
    .select("user_id, role, status, joined_at, created_at, profiles(id, email, full_name)")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: "Unable to load members." }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!canAdminister(context.role)) return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });

  let body: { email?: string; role?: "ADMIN" | "MEMBER" | "VIEWER" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const role = body.role || "MEMBER";
  if (!email || !/^\S+@\S+\.\S+$/.test(email) || !["ADMIN", "MEMBER", "VIEWER"].includes(role)) {
    return NextResponse.json({ error: "A valid email and non-owner role are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: organization } = await supabase
    .from("organizations")
    .select("id")
    .eq("business_id", context.business.id)
    .maybeSingle();
  if (!organization) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

  const rawToken = randomBytes(32).toString("base64url");
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organization_invitations")
    .insert({
      organization_id: organization.id,
      email,
      role,
      token_hash: hashInviteToken(rawToken),
      invited_by: context.userId,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("id, email, role, expires_at, created_at")
    .single();

  if (error) return NextResponse.json({ error: "Unable to create invitation." }, { status: 500 });
  await recordAuthSecurityEvent({
    userId: context.userId,
    organizationId: context.organizationId,
    eventType: "ORGANIZATION_INVITATION_CREATED",
    outcome: "SUCCESS",
    metadata: { invitationId: data.id, role },
  });
  return NextResponse.json({ data, token: rawToken }, { status: 201 });
}

export async function DELETE(request: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!canAdminister(context.role)) return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });

  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId || userId === context.userId) {
    return NextResponse.json({ error: "Choose a member other than yourself." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: organization } = await supabase
    .from("organizations")
    .select("id")
    .eq("business_id", context.business.id)
    .maybeSingle();
  if (!organization) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

  const { error } = await supabase
    .from("organization_members")
    .update({ status: "SUSPENDED" })
    .eq("organization_id", organization.id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: "Unable to suspend member." }, { status: 500 });
  await recordAuthSecurityEvent({
    userId: context.userId,
    organizationId: context.organizationId,
    eventType: "ORGANIZATION_MEMBER_SUSPENDED",
    outcome: "SUCCESS",
    metadata: { memberId: userId },
  });
  return NextResponse.json({ success: true });
}
