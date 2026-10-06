import { NextResponse } from "next/server";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import { listUserDevices, revokeUserDevice } from "@/lib/auth/devices";
import { revokeSessions } from "@/lib/auth/session-revocation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const profile = await getCurrentProfile();
  if (profile?.account_status && profile.account_status !== "ACTIVE") {
    return NextResponse.json({ error: "Account is not active." }, { status: 403 });
  }

  const result = await listUserDevices(user.id);
  if (result.error) return NextResponse.json({ error: "Unable to load devices." }, { status: 500 });
  return NextResponse.json({ data: result.data });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const profile = await getCurrentProfile();
  if (profile?.account_status && profile.account_status !== "ACTIVE") {
    return NextResponse.json({ error: "Account is not active." }, { status: 403 });
  }

  const url = new URL(request.url);
  const deviceId = url.searchParams.get("deviceId");
  const scope = url.searchParams.get("scope");

  if (scope === "global") {
    await revokeSessions("global");
    return NextResponse.json({ success: true, scope });
  }

  if (!deviceId) {
    return NextResponse.json({ error: "deviceId or scope=global is required." }, { status: 400 });
  }

  const result = await revokeUserDevice(user.id, deviceId);
  if (result.error) return NextResponse.json({ error: "Unable to revoke device." }, { status: 500 });
  return NextResponse.json({ success: true, deviceId });
}
