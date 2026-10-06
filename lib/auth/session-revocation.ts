import { createClient } from "@/lib/supabase/server";

export type SignOutScope = "global" | "local" | "others";

export async function revokeSessions(scope: SignOutScope = "global") {
  const supabase = await createClient();
  return supabase.auth.signOut({ scope });
}
