import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness, getCurrentUser } from "@/lib/auth/session";
import type { Database, OrganizationRole } from "@/lib/supabase/types";
import {
  assertMinimumRole,
  assertPermission,
  type OrganizationPermission,
} from "@/lib/permissions";

export interface AuthContext {
  userId: string;
  business: Database["public"]["Tables"]["businesses"]["Row"];
  businessId: string;
  organizationId: string;
  role: OrganizationRole;
}

// Memoized per server render; see lib/auth/session.ts.
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const business = await getCurrentBusiness();
  if (!business) return null;

  const supabase = await createClient();
  // Independent lookups: run them concurrently.
  const [{ data: role, error: roleError }, { data: organization }] = await Promise.all([
    supabase.rpc("auth_user_role_for_business", { p_business_id: business.id }),
    supabase
      .from("organizations")
      .select("id")
      .eq("business_id", business.id)
      .eq("status", "ACTIVE")
      .maybeSingle(),
  ]);

  // Preserve the legacy owner-only behavior while the additive membership
  // migration is being rolled out. Once the RPC exists, its role is authoritative.
  if (roleError || !role) {
    if (!organization) {
      return {
        userId: user.id,
        business,
        businessId: business.id,
        organizationId: business.id,
        role: "OWNER",
      };
    }
    return null;
  }

  if (!organization) return null;
  return {
    userId: user.id,
    business,
    businessId: business.id,
    organizationId: organization.id,
    role,
  };
});

export async function requireAuthContext(): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) {
    redirect("/onboarding");
  }
  return context;
}

export async function requirePermission(
  permission: OrganizationPermission
): Promise<AuthContext> {
  const context = await requireAuthContext();
  assertPermission(context, permission);
  return context;
}

export async function requireMinimumRole(
  minimumRole: OrganizationRole
): Promise<AuthContext> {
  const context = await requireAuthContext();
  assertMinimumRole(context, minimumRole);
  return context;
}
