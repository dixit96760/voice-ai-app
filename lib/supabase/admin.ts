if (typeof window !== "undefined") {
  throw new Error("createAdminClient can only be loaded on the server.");
}

// In Node < 22 runtimes, globalThis.WebSocket is absent. Provide stub so Supabase client initializes without error.
if (typeof (globalThis as unknown as { WebSocket?: unknown }).WebSocket === "undefined") {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = class WebSocket {};
}

import { createClient } from "@supabase/supabase-js";
import { Database } from "./types";

/**
 * Service Role Admin Client.
 *
 * CAUTION: Bypasses Row Level Security (RLS).
 * MUST ONLY be used in server-side API routes, webhooks, and background jobs.
 * NEVER expose to the browser or client-side code.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient can only be loaded on the server.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for admin client."
    );
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
