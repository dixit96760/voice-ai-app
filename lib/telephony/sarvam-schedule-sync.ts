import {
  getSarvamCampaign,
  updateSarvamCampaignSchedule,
  updateSarvamCampaignStatus,
} from "@/lib/providers/sarvam/campaign";
import { DEFAULT_CALLING_DAYS } from "@/lib/validation/campaign";
import type { Database } from "@/lib/supabase/types";

type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];

/** Sarvam campaign states after which it will never dial again. */
export const FINISHED_SARVAM_STATUSES = new Set([
  "ended",
  "completed",
  "cancelled",
  "canceled",
  "expired",
  "finished",
]);

export type ScheduleSyncResult =
  /** Schedule updated; `remoteStatus` is Sarvam's status afterwards. */
  | { outcome: "synced"; remoteStatus: string }
  /** The Sarvam campaign has ended; a new one must be created to dial again. */
  | { outcome: "finished" };

/**
 * Pushes the campaign's calling days and hours to its existing Sarvam
 * campaign. The schedule is only sent when a Sarvam campaign is created, so
 * without this an edit (e.g. adding Sunday) never reaches Sarvam.
 *
 * Sarvam accepts schedule changes only while paused or scheduled, so an
 * active campaign is paused first and left paused for the caller to resume.
 */
export async function syncSarvamCampaignSchedule(
  sarvamCampaignId: string,
  campaign: Pick<Campaign, "calling_days" | "calling_start_time" | "calling_end_time" | "timezone">
): Promise<ScheduleSyncResult> {
  const remote = (await getSarvamCampaign(sarvamCampaignId)) as unknown as { status?: string };
  let remoteStatus = String(remote.status || "").toLowerCase();
  if (FINISHED_SARVAM_STATUSES.has(remoteStatus)) return { outcome: "finished" };

  if (remoteStatus === "active") {
    await updateSarvamCampaignStatus(sarvamCampaignId, "pause");
    remoteStatus = "paused";
  }

  await updateSarvamCampaignSchedule(sarvamCampaignId, {
    start_time: campaign.calling_start_time,
    end_time: campaign.calling_end_time,
    allowed_days: campaign.calling_days || DEFAULT_CALLING_DAYS,
    timezone: campaign.timezone || "Asia/Kolkata",
  });

  return { outcome: "synced", remoteStatus };
}
