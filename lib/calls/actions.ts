"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireBusiness } from "@/lib/auth/session";
import { listCalls, getCallDetail, ListCallsFilters, CallDetailResult, CallListItem } from "./call-service";
import { getCallRecordingSignedUrl } from "./recording-service";

async function getAuthenticatedBusiness() {
  const { user, business } = await requireBusiness();
  const supabase = await createClient();
  return { supabase, user, business };
}

/**
 * Server action to fetch paginated calls list.
 */
export async function getCallsListAction(
  filters: Omit<ListCallsFilters, "businessId">
): Promise<{ success: boolean; calls?: CallListItem[]; total?: number; error?: string }> {
  try {
    const { business } = await getAuthenticatedBusiness();
    const result = await listCalls({ ...filters, businessId: business.id });
    return { success: true, calls: result.calls, total: result.total };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Server action to fetch comprehensive call detail.
 */
export async function getCallDetailAction(
  callId: string
): Promise<{ success: boolean; data?: CallDetailResult; error?: string }> {
  try {
    const { business } = await getAuthenticatedBusiness();
    const result = await getCallDetail(callId, business.id);
    if (!result) {
      return { success: false, error: "Call record not found." };
    }
    return { success: true, data: result };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Server action to generate temporary signed audio playback URL.
 */
export async function getRecordingPlaybackUrlAction(
  callId: string
): Promise<{ success: boolean; signedUrl?: string | null; durationSeconds?: number | null; error?: string }> {
  try {
    const { business } = await getAuthenticatedBusiness();
    const res = await getCallRecordingSignedUrl(callId, business.id);
    return { success: true, signedUrl: res.signedUrl, durationSeconds: res.durationSeconds };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Server action to update scheduled callback status.
 */
export async function updateCallbackStatusAction(
  callbackId: string,
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED",
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, business } = await getAuthenticatedBusiness();

    const { error } = await supabase
      .from("callbacks")
      .update({
        status,
        notes: notes || undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", callbackId)
      .eq("business_id", business.id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/calls");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}
