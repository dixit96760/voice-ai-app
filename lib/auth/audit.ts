import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

function hashRequestValue(value: string | null): string | null {
  if (!value) return null;
  const pepper =
    process.env.AUTH_API_KEY_PEPPER || process.env.SUPABASE_SERVICE_ROLE_KEY || "local-only";
  return createHash("sha256").update(`${pepper}:${value}`).digest("hex");
}

async function requestContext() {
  const requestHeaders = await headers();
  return {
    ipHash: hashRequestValue(
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || null
    ),
    userAgent: requestHeaders.get("user-agent") || null,
  };
}

export async function recordAuthSecurityEvent(input: {
  userId?: string | null;
  organizationId?: string | null;
  eventType: string;
  outcome?: "SUCCESS" | "FAILURE";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const request = await requestContext();
  const row = {
    user_id: input.userId ?? null,
    organization_id: input.organizationId ?? null,
    event_type: input.eventType,
    outcome: input.outcome ?? "SUCCESS",
    metadata: (input.metadata ?? {}) as Json,
    ip_hash: request.ipHash,
    user_agent: request.userAgent,
  };

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("auth_security_events").insert(row);
    if (!error) return;
  } catch {
    // Fall through to the server-only audit writer when the user client cannot
    // write (for example, an unauthenticated signup attempt).
  }

  try {
    const admin = createAdminClient();
    await admin.from("auth_security_events").insert(row);
  } catch (error) {
    console.error("Failed to record auth security event:", error);
  }
}
