import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/supabase/types";
import type { User } from "@supabase/supabase-js";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Business = Database["public"]["Tables"]["businesses"]["Row"];

// The session helpers below are memoized per server render with React's
// cache(), so a layout and page that both ask for the user, profile or
// business share one lookup instead of repeating Supabase round trips.
// Outside a render (server actions, route handlers) cache() is a no-op.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }
  return user;
});

export async function ensureProfile(user: User): Promise<Profile | null> {
  const supabase = await createClient();
  const fullName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    "";
  const avatarUrl =
    user.user_metadata?.avatar_url ||
    user.user_metadata?.picture ||
    null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email || "",
        full_name: fullName,
        phone: user.phone || null,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id", ignoreDuplicates: false }
    )
    .select("*")
    .single();

  if (error) {
    console.error("Error ensuring profile:", error.message);
  }

  return profile;
}

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return ensureProfile(user);
  }

  return profile;
});

export const getCurrentBusiness = cache(async (): Promise<Business | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const profile = await getCurrentProfile();
  if (!profile || (profile.account_status && profile.account_status !== "ACTIVE")) {
    return null;
  }

  const supabase = await createClient();
  let businessId: string | null = null;

  // Prefer an active organization membership. The owner lookup remains as a
  // compatibility fallback for databases that have not run the membership
  // migration yet.
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "ACTIVE")
    .limit(1)
    .maybeSingle();

  if (membership?.organization_id) {
    const { data: organization } = await supabase
      .from("organizations")
      .select("business_id")
      .eq("id", membership.organization_id)
      .eq("status", "ACTIVE")
      .maybeSingle();
    businessId = organization?.business_id ?? null;
  }

  if (!businessId) {
    const { data: ownedBusiness } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();
    businessId = ownedBusiness?.id ?? null;
  }

  if (!businessId) return null;

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .maybeSingle();

  return business;
});

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  if (user.email && !user.phone && user.email_confirmed_at === null) {
    redirect("/login?error=Verify+your+email+address+before+continuing");
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login?error=Unable+to+load+your+account+profile");
  }
  if (profile.account_status && profile.account_status !== "ACTIVE") {
    const message =
      profile.account_status === "PENDING_VERIFICATION"
        ? "Verify your email address before continuing."
        : profile.account_status === "SUSPENDED"
          ? "This account is suspended. Contact your administrator."
          : profile.account_status === "LOCKED"
            ? "This account is temporarily locked. Contact your administrator."
            : profile.account_status === "DELETION_PENDING"
              ? "This account is pending deletion."
              : "This account has been deactivated.";
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  return user;
}

export async function requireBusiness(): Promise<{ user: User; business: Business }> {
  const user = await requireAuth();
  const business = await getCurrentBusiness();
  if (!business) {
    redirect("/onboarding");
  }
  return { user, business };
}

export async function requireNoBusiness(): Promise<User> {
  const user = await requireAuth();
  const business = await getCurrentBusiness();
  if (business) {
    redirect("/dashboard");
  }
  return user;
}
