"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/auth/session";
import { getBusinessUsageSummary, BusinessUsageSummary } from "./usage-service";

async function getAuthenticatedBusiness() {
  const { user, business } = await requireBusiness();
  const supabase = await createClient();
  return { supabase, user, business };
}

/**
 * Server action to retrieve billable usage summary for current business.
 */
export async function getBusinessUsageAction(
  fromDate?: string,
  toDate?: string
): Promise<{ success: boolean; data?: BusinessUsageSummary; error?: string }> {
  try {
    const { business } = await getAuthenticatedBusiness();
    const summary = await getBusinessUsageSummary(business.id, fromDate, toDate);
    return { success: true, data: summary };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}
