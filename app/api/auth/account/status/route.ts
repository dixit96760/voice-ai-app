import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { revokeSessions } from "@/lib/auth/session-revocation";
import type { AccountStatus } from "@/lib/supabase/types";
import { recordAuthSecurityEvent } from "@/lib/auth/audit";

const allowedStatuses: AccountStatus[] = [
  "PENDING_VERIFICATION",
  "ACTIVE",
  "SUSPENDED",
  "LOCKED",
  "DEACTIVATED",
  "DELETION_PENDING",
];

export async function PATCH(request: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (context.role !== "OWNER" && context.role !== "ADMIN") {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  let body: { userId?: string; status?: AccountStatus };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.userId || !body.status || !allowedStatuses.includes(body.status)) {
    return NextResponse.json({ error: "A valid userId and account status are required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: targetMembership } = await admin
    .from("organization_members")
    .select("user_id, role")
    .eq("organization_id", context.organizationId)
    .eq("user_id", body.userId)
    .maybeSingle();
  if (!targetMembership) {
    return NextResponse.json({ error: "User is not a member of this organization." }, { status: 404 });
  }
  if (targetMembership.role === "OWNER" && body.status !== "ACTIVE") {
    return NextResponse.json({ error: "The organization owner must remain active." }, { status: 409 });
  }

  const { error } = await admin
    .from("profiles")
    .update({
      account_status: body.status,
      account_status_changed_at: new Date().toISOString(),
    })
    .eq("id", body.userId);

  if (error) return NextResponse.json({ error: "Unable to update account status." }, { status: 500 });

  await recordAuthSecurityEvent({
    userId: context.userId,
    organizationId: context.organizationId,
    eventType: "ACCOUNT_STATUS_CHANGED",
    outcome: "SUCCESS",
    metadata: { targetUserId: body.userId, status: body.status },
  });

  if (body.userId === context.userId && body.status !== "ACTIVE") {
    await revokeSessions("global");
  }

  return NextResponse.json({ success: true });
}
