import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth/permissions";
import { STORAGE_BUCKETS } from "@/lib/storage";
import { archiveCallRecording } from "./recording-archive";

/** Recordings contain customers' voices, so only owners and admins can hear them. */
const RECORDING_ROLES = new Set(["OWNER", "ADMIN"]);

export interface CallRecordingAccess {
  /** Temporary link for in-page playback. */
  signedUrl: string | null;
  /** Temporary link that downloads the file. */
  downloadUrl: string | null;
  durationSeconds: number | null;
  /** The viewer's role may not access recordings. */
  restricted: boolean;
}

const NONE: CallRecordingAccess = {
  signedUrl: null,
  downloadUrl: null,
  durationSeconds: null,
  restricted: false,
};

/**
 * Generates authorized, time-limited links to a call's recording for the
 * business owner or an admin. Fetches the recording from Sarvam on demand if
 * the scheduler has not archived it yet.
 */
export async function getCallRecordingSignedUrl(
  callId: string,
  businessId: string,
  expiresInSeconds = 3600
): Promise<CallRecordingAccess> {
  const context = await getAuthContext();
  if (!context || context.businessId !== businessId) return NONE;
  if (!RECORDING_ROLES.has(context.role)) return { ...NONE, restricted: true };

  // Row-level security confirms the call belongs to this business.
  const supabase = await createClient();
  const { data: call } = await supabase
    .from("calls")
    .select("id, business_id, provider_interaction_id, provider_attempt_id, duration_seconds")
    .eq("id", callId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!call) return NONE;

  // Recordings live in a private bucket with no client access; the server
  // signs links only after the checks above.
  const admin = createAdminClient();
  const loadRecording = () =>
    admin
      .from("call_recordings")
      .select("storage_path, duration_seconds")
      .eq("call_id", callId)
      .maybeSingle();

  let { data: recording } = await loadRecording();
  if (!recording?.storage_path || /^https?:\/\//.test(recording.storage_path)) {
    try {
      const outcome = await archiveCallRecording(call, admin);
      if (outcome === "archived") ({ data: recording } = await loadRecording());
    } catch (err) {
      console.error("On-demand recording archive failed:", err);
    }
  }

  if (!recording?.storage_path || /^https?:\/\//.test(recording.storage_path)) {
    return NONE;
  }

  const bucket = admin.storage.from(STORAGE_BUCKETS.RECORDINGS);
  const [play, download] = await Promise.all([
    bucket.createSignedUrl(recording.storage_path, expiresInSeconds),
    bucket.createSignedUrl(recording.storage_path, expiresInSeconds, {
      download: `call-${callId}.${recording.storage_path.split(".").pop() || "wav"}`,
    }),
  ]);

  return {
    signedUrl: play.data?.signedUrl ?? null,
    downloadUrl: download.data?.signedUrl ?? null,
    durationSeconds: recording.duration_seconds ?? call.duration_seconds,
    restricted: false,
  };
}
