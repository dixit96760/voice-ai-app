import { createAdminClient } from "@/lib/supabase/admin";
import { downloadSarvamRecording } from "@/lib/providers/sarvam/recordings";
import { resolveAgentAppId } from "@/lib/providers/sarvam/config";
import { STORAGE_BUCKETS } from "@/lib/storage";

type AdminClient = ReturnType<typeof createAdminClient>;

export const DEFAULT_RECORDING_RETENTION_DAYS = 45;

export interface ArchivableCall {
  id: string;
  business_id: string;
  provider_interaction_id: string | null;
  provider_attempt_id: string | null;
  duration_seconds: number | null;
}

export type ArchiveOutcome = "archived" | "already_archived" | "not_ready" | "no_recording";

/** Storage object path: one folder per business, one file per call. */
export function recordingStoragePath(businessId: string, callId: string, contentType: string): string {
  const extension = contentType.includes("mpeg") ? "mp3" : contentType.includes("ogg") ? "ogg" : "wav";
  return `${businessId}/${callId}.${extension}`;
}

/** The agent that handled the call, read from its webhook, else the configured default. */
async function resolveCallAppId(supabase: AdminClient, call: ArchivableCall): Promise<string> {
  if (call.provider_attempt_id) {
    const { data } = await supabase
      .from("webhook_events")
      .select("payload")
      .eq("provider", "sarvam")
      .eq("provider_event_id", call.provider_attempt_id)
      .maybeSingle();
    const appId = (data?.payload as { app_id?: unknown } | null)?.app_id;
    if (typeof appId === "string" && appId && appId !== "instant-outbound") return appId;
  }
  return resolveAgentAppId();
}

async function retentionDays(supabase: AdminClient, businessId: string): Promise<number> {
  const { data } = await supabase
    .from("subscriptions")
    .select("limits")
    .eq("business_id", businessId)
    .maybeSingle();
  const days = Number((data?.limits as { recording_retention_days?: unknown } | null)?.recording_retention_days);
  return Number.isFinite(days) && days > 0 ? days : DEFAULT_RECORDING_RETENTION_DAYS;
}

/**
 * Copies a call's recording from Sarvam into the private `call-recordings`
 * bucket and records it in call_recordings, so playback does not depend on
 * how long Sarvam keeps it. Safe to call repeatedly.
 */
export async function archiveCallRecording(
  call: ArchivableCall,
  client?: AdminClient
): Promise<ArchiveOutcome> {
  const supabase = client ?? createAdminClient();

  if (!call.provider_interaction_id || !call.duration_seconds) return "no_recording";

  const { data: existing } = await supabase
    .from("call_recordings")
    .select("storage_path")
    .eq("call_id", call.id)
    .maybeSingle();
  if (existing?.storage_path && !/^https?:\/\//.test(existing.storage_path)) {
    return "already_archived";
  }

  const appId = await resolveCallAppId(supabase, call);
  const recording = await downloadSarvamRecording(appId, call.provider_interaction_id);
  if (!recording) return "not_ready";

  const path = recordingStoragePath(call.business_id, call.id, recording.contentType);
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.RECORDINGS)
    .upload(path, recording.audio, { contentType: recording.contentType, upsert: true });
  if (uploadError) {
    throw new Error(`Recording upload failed: ${uploadError.message}`);
  }

  const now = new Date();
  const days = await retentionDays(supabase, call.business_id);
  const { error: rowError } = await supabase.from("call_recordings").upsert(
    {
      call_id: call.id,
      provider_recording_id: call.provider_interaction_id,
      storage_path: path,
      duration_seconds: call.duration_seconds,
      file_size: recording.audio.byteLength,
      mime_type: recording.contentType,
      available_at: now.toISOString(),
      expires_at: new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: "call_id" }
  );
  if (rowError) {
    throw new Error(`Recording record failed: ${rowError.message}`);
  }

  return "archived";
}
