"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/auth/session";
import { generateCampaignCallsCsv } from "./export-service";

async function getAuthenticatedBusiness() {
  const { user, business } = await requireBusiness();
  const supabase = await createClient();
  return { supabase, user, business };
}

/**
 * Generates and returns a CSV dataset of campaign calls for export.
 */
export async function exportCampaignCallsAction(
  campaignId: string
): Promise<{ success: boolean; csv?: string; filename?: string; error?: string }> {
  try {
    const { business } = await getAuthenticatedBusiness();
    const csv = await generateCampaignCallsCsv(campaignId, business.id);
    const filename = `campaign_calls_${campaignId.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.csv`;

    return { success: true, csv, filename };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}
