import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

function fingerprint(value: string): string {
  const pepper = process.env.AUTH_API_KEY_PEPPER || process.env.SUPABASE_SERVICE_ROLE_KEY || "local-only";
  return createHash("sha256").update(`${pepper}:${value}`).digest("hex");
}

export async function recordCurrentDevice(userId: string): Promise<void> {
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent") || "unknown";
  const forwardedFor = requestHeaders.get("x-forwarded-for") || "unknown";
  const deviceHash = fingerprint(`${userAgent}:${forwardedFor}`);

  const supabase = await createClient();
  await supabase.from("auth_devices").upsert(
    {
      user_id: userId,
      device_hash: deviceHash,
      user_agent: userAgent,
      ip_hash: fingerprint(forwardedFor),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,device_hash" }
  );
}

export async function listUserDevices(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("auth_devices")
    .select("id, label, user_agent, last_seen_at, revoked_at, created_at")
    .eq("user_id", userId)
    .order("last_seen_at", { ascending: false });
  return { data, error };
}

export async function revokeUserDevice(userId: string, deviceId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("auth_devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", deviceId)
    .eq("user_id", userId);
  return { error };
}
