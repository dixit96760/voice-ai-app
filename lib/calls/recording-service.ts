import { createClient } from "@/lib/supabase/server";

/**
 * Generates an authorized, time-limited signed URL for private call recording playback.
 */
export async function getCallRecordingSignedUrl(
  callId: string,
  businessId: string,
  expiresInSeconds = 3600
): Promise<{ signedUrl: string | null; durationSeconds: number | null }> {
  const supabase = await createClient();

  // 1. Verify call belongs to the business
  const { data: call } = await supabase
    .from("calls")
    .select("id, provider_interaction_id, duration_seconds")
    .eq("id", callId)
    .eq("business_id", businessId)
    .single();

  if (!call) {
    return { signedUrl: null, durationSeconds: null };
  }

  // 2. Fetch recording reference
  let { data: recording } = await supabase
    .from("call_recordings")
    .select("storage_path, duration_seconds")
    .eq("call_id", callId)
    .maybeSingle();

  // On-demand lazy fetch if not yet persisted but provider_interaction_id exists
  if ((!recording || !recording.storage_path) && call.provider_interaction_id) {
    try {
      const { getSarvamCallRecording } = await import(
        "@/lib/providers/sarvam/recordings"
      );
      const providerRec = await getSarvamCallRecording(
        call.provider_interaction_id
      );
      if (providerRec.recordingUrl) {
        const { data: upserted } = await supabase
          .from("call_recordings")
          .upsert(
            {
              call_id: callId,
              provider_recording_id: call.provider_interaction_id,
              storage_path: providerRec.recordingUrl,
              duration_seconds:
                providerRec.durationSeconds || call.duration_seconds || 0,
              mime_type: providerRec.mimeType || "audio/wav",
              available_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            },
            { onConflict: "call_id" }
          )
          .select("storage_path, duration_seconds")
          .single();
        if (upserted) {
          recording = upserted;
        }
      }
    } catch {
      // Fallback gracefully if Sarvam recording is not yet ready or unavailable
    }
  }

  if (!recording || !recording.storage_path) {
    return { signedUrl: null, durationSeconds: null };
  }

  // If storage path is already an external HTTP/HTTPS URL
  if (recording.storage_path.startsWith("http://") || recording.storage_path.startsWith("https://")) {
    return {
      signedUrl: recording.storage_path,
      durationSeconds: recording.duration_seconds,
    };
  }

  // Generate signed URL from private Supabase bucket
  const { data, error } = await supabase.storage
    .from("call-recordings")
    .createSignedUrl(recording.storage_path, expiresInSeconds);

  if (error || !data) {
    return { signedUrl: null, durationSeconds: recording.duration_seconds };
  }

  return {
    signedUrl: data.signedUrl,
    durationSeconds: recording.duration_seconds,
  };
}
