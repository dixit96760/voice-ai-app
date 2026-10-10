import { createAdminClient } from "@/lib/supabase/admin";
import { getSarvamCampaign } from "@/lib/providers/sarvam/campaign";
import { createSarvamInstantCall } from "@/lib/providers/sarvam/outbound";
import { buildAgentVariableValues } from "@/lib/providers/sarvam/cohort";
import { buildTokenUrl, SARVAM_OUTBOUND_WEBHOOK_PATH } from "@/lib/providers/sarvam/config";
import { buildCampaignBrief } from "@/lib/providers/sarvam/agent";
import { quotaService } from "@/lib/billing/quota-service";
import { archiveCallRecording } from "@/lib/calls/recording-archive";
import { STORAGE_BUCKETS } from "@/lib/storage";
import {
  PERMITTED_CALLING_END,
  PERMITTED_CALLING_START,
  toMinutes,
} from "@/lib/validation/campaign";
import type { Database } from "@/lib/supabase/types";

type AdminClient = ReturnType<typeof createAdminClient>;
type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];

/** Sarvam campaign states after which no more calls will be placed. */
const FINISHED_SARVAM_STATUSES = new Set([
  "ended",
  "completed",
  "cancelled",
  "canceled",
  "expired",
  "finished",
]);

const RECYCLE_BIN_DAYS = 30;
const MAX_CALLBACK_DIAL_ATTEMPTS = 3;
/** A callback this long past its requested time is marked MISSED, not dialled. */
const MAX_CALLBACK_AGE_MS = 48 * 60 * 60 * 1000;
/** Callbacks dialled per scheduler run; held ones (paused campaigns) don't count. */
const MAX_CALLBACKS_DIALED_PER_RUN = 20;
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["TRIAL", "ACTIVE", "PAST_DUE"]);

export interface SchedulerReport {
  campaignsCompleted: number;
  callbacksDialed: number;
  campaignsPurged: number;
  recordingsArchived: number;
  recordingsExpired: number;
  errors: string[];
}

/** Recordings copied per run; each is a ~1 MB/minute download and upload. */
const MAX_RECORDINGS_ARCHIVED_PER_RUN = 5;
/** Sarvam produces the recording shortly after the call ends. */
const RECORDING_READY_DELAY_MS = 60 * 1000;
/** Stop trying to fetch a recording after this long. */
const RECORDING_ARCHIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Current IST wall-clock time as minutes since midnight and ISO weekday (1 = Monday). */
export function istClock(now: Date): { minutes: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hour = Number(get("hour")) % 24;
  return {
    minutes: hour * 60 + Number(get("minute")),
    weekday: weekdays.indexOf(get("weekday")) + 1,
  };
}

/**
 * Whether a call may be placed now: inside the campaign's own window and days
 * (when known) and always inside the TRAI 09:00-21:00 IST window.
 */
export function isWithinCallingWindow(
  now: Date,
  campaign?: Pick<Campaign, "calling_start_time" | "calling_end_time" | "calling_days"> | null
): boolean {
  const { minutes, weekday } = istClock(now);
  const start = Math.max(
    toMinutes(PERMITTED_CALLING_START),
    campaign?.calling_start_time ? toMinutes(campaign.calling_start_time.slice(0, 5)) : 0
  );
  const end = Math.min(
    toMinutes(PERMITTED_CALLING_END),
    campaign?.calling_end_time ? toMinutes(campaign.calling_end_time.slice(0, 5)) : 24 * 60
  );
  const days = campaign?.calling_days?.length ? campaign.calling_days : [1, 2, 3, 4, 5, 6];
  return minutes >= start && minutes < end && days.includes(weekday);
}

/**
 * Marks RUNNING campaigns COMPLETED once Sarvam has finished dialling them,
 * and settles their quota holds. Without this a finished campaign stays
 * RUNNING and blocks the business from launching another.
 */
export async function completeFinishedCampaigns(
  supabase: AdminClient,
  now: Date,
  errors: string[]
): Promise<number> {
  const { data: running } = await supabase
    .from("campaigns")
    .select("id, business_id, sarvam_campaign_id")
    .eq("status", "RUNNING")
    .is("deleted_at", null)
    .not("sarvam_campaign_id", "is", null)
    .limit(50);

  let completed = 0;
  for (const campaign of running || []) {
    try {
      const remote = (await getSarvamCampaign(campaign.sarvam_campaign_id!)) as unknown as {
        status?: string;
        end_timestamp?: string;
      };
      const status = String(remote.status || "").toLowerCase();
      const pastEnd = remote.end_timestamp ? Date.parse(remote.end_timestamp) < now.getTime() : false;
      if (!FINISHED_SARVAM_STATUSES.has(status) && !pastEnd) continue;

      const finishedAt = now.toISOString();
      const { data: updated } = await supabase
        .from("campaigns")
        .update({ status: "COMPLETED", completed_at: finishedAt, updated_at: finishedAt })
        .eq("id", campaign.id)
        .eq("status", "RUNNING")
        .select("id");
      if (!updated?.length) continue;

      await quotaService.settleCampaignReservations(campaign.id, campaign.business_id);
      await supabase.from("audit_logs").insert({
        business_id: campaign.business_id,
        action: "CAMPAIGN_COMPLETED",
        entity_type: "campaign",
        entity_id: campaign.id,
        new_values: { reason: "Sarvam campaign finished", sarvam_status: status || "past_end" },
      });
      completed++;
    } catch (err) {
      errors.push(`complete ${campaign.id}: ${(err as Error).message}`);
    }
  }
  return completed;
}

/**
 * Redials callbacks whose requested time has arrived, inside the calling
 * window. Each callback is claimed with a compare-and-set so overlapping
 * scheduler runs cannot dial it twice.
 */
export async function dialDueCallbacks(
  supabase: AdminClient,
  now: Date,
  errors: string[]
): Promise<number> {
  const { data: due } = await supabase
    .from("callbacks")
    .select("id, business_id, campaign_id, contact_id, dial_attempts, scheduled_for, notes")
    .eq("status", "SCHEDULED")
    .lte("scheduled_for", now.toISOString())
    .lt("dial_attempts", MAX_CALLBACK_DIAL_ATTEMPTS)
    .order("scheduled_for", { ascending: true })
    .limit(100);

  const closeCallback = (
    callback: { id: string; notes: string | null },
    status: "CANCELLED" | "MISSED",
    reason: string
  ) =>
    supabase
      .from("callbacks")
      .update({
        status,
        notes: [callback.notes, reason].filter(Boolean).join(" | "),
        updated_at: now.toISOString(),
      })
      .eq("id", callback.id)
      .eq("status", "SCHEDULED");

  let dialed = 0;
  for (const callback of due || []) {
    if (dialed >= MAX_CALLBACKS_DIALED_PER_RUN) break;
    try {
      // Too long past the requested time: calling now would surprise the
      // customer, so record it as missed for the team to follow up.
      if (now.getTime() - Date.parse(callback.scheduled_for) > MAX_CALLBACK_AGE_MS) {
        await closeCallback(
          callback,
          "MISSED",
          "Not dialled: more than 48 hours past the requested time."
        );
        continue;
      }

      const [{ data: contact }, { data: campaign }, { data: business }, { data: subscription }] =
        await Promise.all([
          supabase
            .from("contacts")
            .select("id, name, city, phone, is_dnc, is_wrong_number")
            .eq("id", callback.contact_id)
            .maybeSingle(),
          callback.campaign_id
            ? supabase.from("campaigns").select("*").eq("id", callback.campaign_id).maybeSingle()
            : Promise.resolve({ data: null }),
          supabase
            .from("businesses")
            .select("*")
            .eq("id", callback.business_id)
            .maybeSingle(),
          supabase
            .from("subscriptions")
            .select("status")
            .eq("business_id", callback.business_id)
            .maybeSingle(),
        ]);

      if (!contact || !business || contact.is_dnc || contact.is_wrong_number) {
        await closeCallback(
          callback,
          "CANCELLED",
          "Callback cancelled: contact is on the DNC list, a wrong number, or missing."
        );
        continue;
      }

      if (campaign?.deleted_at) {
        await closeCallback(callback, "CANCELLED", "Callback cancelled: the campaign was deleted.");
        continue;
      }

      // The business paused this campaign: hold the callback (it stays
      // SCHEDULED) and dial it once the campaign is resumed.
      if (campaign?.status === "PAUSED") continue;

      if (!subscription || !ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) continue;
      if (!isWithinCallingWindow(now, campaign as Campaign | null)) continue;

      // Claim before dialling so concurrent runs skip it.
      const { data: claimed } = await supabase
        .from("callbacks")
        .update({
          status: "QUEUED",
          dial_attempts: (callback.dial_attempts || 0) + 1,
          last_dialed_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", callback.id)
        .eq("status", "SCHEDULED")
        .select("id");
      if (!claimed?.length) continue;

      const { data: sources } = campaign
        ? await supabase.from("campaign_sources").select("*").eq("campaign_id", campaign.id)
        : { data: [] };

      const agentVariables = buildAgentVariableValues(contact, {
        businessName: business.business_name,
        campaignOffering: campaign?.offering_type || undefined,
        campaignObjective: campaign?.objective
          ? `${campaign.objective}. This is the callback the customer asked for earlier.`
          : "This is the callback the customer asked for earlier. Continue the conversation.",
        campaignBrief: campaign
          ? buildCampaignBrief({ business, campaign: campaign as Campaign, sources: sources || [] })
          : "",
        campaignId: campaign?.id,
      });

      try {
        const { attemptId } = await createSarvamInstantCall({
          userPhoneNumber: contact.phone,
          agentVariables,
          webhook: {
            url: buildTokenUrl(SARVAM_OUTBOUND_WEBHOOK_PATH),
            metadata: {
              callback_id: callback.id,
              contact_id: contact.id,
              campaign_id: campaign?.id || "",
              user_phone_number: contact.phone,
            },
          },
        });
        await supabase
          .from("callbacks")
          .update({ provider_attempt_id: attemptId, status: "CALLING", updated_at: now.toISOString() })
          .eq("id", callback.id);
        dialed++;
      } catch (err) {
        // Return it to the queue; dial_attempts caps the retries.
        await supabase
          .from("callbacks")
          .update({ status: "SCHEDULED", updated_at: now.toISOString() })
          .eq("id", callback.id);
        errors.push(`callback ${callback.id}: ${(err as Error).message}`);
      }
    } catch (err) {
      errors.push(`callback ${callback.id}: ${(err as Error).message}`);
    }
  }
  return dialed;
}

/**
 * Permanently deletes campaigns that have been in the recycle bin for more
 * than 30 days. Calls, callbacks, usage and messages are kept (their
 * campaign link is cleared); the campaign's own setup is removed.
 */
export async function purgeRecycleBin(
  supabase: AdminClient,
  now: Date,
  errors: string[]
): Promise<number> {
  const cutoff = new Date(now.getTime() - RECYCLE_BIN_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: purged, error } = await supabase
    .from("campaigns")
    .delete()
    .lt("deleted_at", cutoff)
    .neq("status", "RUNNING")
    .select("id");
  if (error) {
    errors.push(`purge: ${error.message}`);
    return 0;
  }
  return purged?.length || 0;
}

/**
 * Copies recordings of recently connected calls from Sarvam into the private
 * call-recordings bucket, so owners can play them after Sarvam's copy expires.
 */
export async function archivePendingRecordings(
  supabase: AdminClient,
  now: Date,
  errors: string[]
): Promise<number> {
  const { data: calls } = await supabase
    .from("calls")
    .select(
      "id, business_id, provider_interaction_id, provider_attempt_id, duration_seconds, call_recordings(id)"
    )
    .not("provider_interaction_id", "is", null)
    .gt("duration_seconds", 0)
    .gte("created_at", new Date(now.getTime() - RECORDING_ARCHIVE_WINDOW_MS).toISOString())
    .lte("created_at", new Date(now.getTime() - RECORDING_READY_DELAY_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(100);

  const pending = (calls || []).filter((call) => {
    const rows = (call as { call_recordings?: unknown }).call_recordings;
    return !rows || (Array.isArray(rows) && rows.length === 0);
  });

  let archived = 0;
  for (const call of pending.slice(0, MAX_RECORDINGS_ARCHIVED_PER_RUN)) {
    try {
      if ((await archiveCallRecording(call, supabase)) === "archived") archived++;
    } catch (err) {
      errors.push(`recording ${call.id}: ${(err as Error).message}`);
    }
  }
  return archived;
}

/** Deletes recordings past their retention date (expires_at), file and record. */
export async function purgeExpiredRecordings(
  supabase: AdminClient,
  now: Date,
  errors: string[]
): Promise<number> {
  const { data: expired } = await supabase
    .from("call_recordings")
    .select("id, storage_path")
    .lt("expires_at", now.toISOString())
    .limit(100);
  if (!expired?.length) return 0;

  const stored = expired
    .map((r) => r.storage_path)
    .filter((path): path is string => Boolean(path) && !/^https?:\/\//.test(path));
  if (stored.length) {
    const { error } = await supabase.storage.from(STORAGE_BUCKETS.RECORDINGS).remove(stored);
    if (error) {
      errors.push(`recording purge: ${error.message}`);
      return 0;
    }
  }

  const { error } = await supabase
    .from("call_recordings")
    .delete()
    .in(
      "id",
      expired.map((r) => r.id)
    );
  if (error) {
    errors.push(`recording purge: ${error.message}`);
    return 0;
  }
  return expired.length;
}

export async function runScheduledJobs(
  now = new Date(),
  client?: AdminClient
): Promise<SchedulerReport> {
  const supabase = client ?? createAdminClient();
  const errors: string[] = [];

  const campaignsCompleted = await completeFinishedCampaigns(supabase, now, errors);
  const callbacksDialed = await dialDueCallbacks(supabase, now, errors);
  const campaignsPurged = await purgeRecycleBin(supabase, now, errors);
  const recordingsArchived = await archivePendingRecordings(supabase, now, errors);
  const recordingsExpired = await purgeExpiredRecordings(supabase, now, errors);

  return {
    campaignsCompleted,
    callbacksDialed,
    campaignsPurged,
    recordingsArchived,
    recordingsExpired,
    errors,
  };
}
