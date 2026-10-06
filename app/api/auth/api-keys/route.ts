import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/permissions";
import { issueApiKey } from "@/lib/auth/api-key-server";
import { createClient } from "@/lib/supabase/server";
import { recordAuthSecurityEvent } from "@/lib/auth/audit";

const allowedScopes = new Set([
  "read",
  "campaigns:read",
  "campaigns:write",
  "contacts:read",
  "contacts:write",
  "calls:read",
  "calls:write",
  "analytics:read",
]);

function canAdminister(role: string): boolean {
  return role === "OWNER";
}

export async function GET() {
  const context = await getAuthContext();
  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!canAdminister(context.role)) {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, scopes, status, last_used_at, expires_at, revoked_at, created_at")
    .eq("organization_id", context.organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Unable to load API keys." }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const context = await getAuthContext();
  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!canAdminister(context.role)) {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  let body: { name?: string; scopes?: string[]; expiresAt?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = body.name?.trim();
  const scopes = Array.isArray(body.scopes)
    ? body.scopes.filter((scope): scope is string => typeof scope === "string")
    : ["read"];

  if (
    !name ||
    name.length > 100 ||
    scopes.length === 0 ||
    scopes.some((scope) => !allowedScopes.has(scope))
  ) {
    return NextResponse.json(
      { error: "A name and at least one valid scope are required." },
      { status: 400 }
    );
  }

  try {
    const result = await issueApiKey({
      organizationId: context.organizationId,
      createdBy: context.userId,
      name,
      scopes,
      expiresAt: body.expiresAt,
    });
    await recordAuthSecurityEvent({
      userId: context.userId,
      organizationId: context.organizationId,
      eventType: "API_KEY_CREATED",
      outcome: "SUCCESS",
      metadata: { keyId: result.record.id, keyPrefix: result.record.key_prefix },
    });
    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create API key." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const context = await getAuthContext();
  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!canAdminister(context.role)) {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "API key id is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("api_keys")
    .update({ status: "REVOKED", revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", context.organizationId);

  if (error) {
    return NextResponse.json({ error: "Unable to revoke API key." }, { status: 500 });
  }

  await recordAuthSecurityEvent({
    userId: context.userId,
    organizationId: context.organizationId,
    eventType: "API_KEY_REVOKED",
    outcome: "SUCCESS",
    metadata: { keyId: id },
  });
  return NextResponse.json({ success: true });
}
