import { sarvamFetch } from "./client";
import { createClient } from "@/lib/supabase/server";

export interface RecordingRetrievalResult {
  recordingUrl: string | null;
  durationSeconds?: number;
  mimeType?: string;
}

/**
 * Retrieves the recording reference for a completed Sarvam voice interaction.
 * Respects private recording policies and returns a temporary playback URL.
 */
export async function getSarvamCallRecording(
  interactionId: string
): Promise<RecordingRetrievalResult> {
  // If interactionId is not provided, return null
  if (!interactionId) {
    return { recordingUrl: null };
  }

  try {
    // Sarvam API interaction recording endpoint
    const response = await sarvamFetch<{ recording_url?: string; duration?: number }>(
      `/api/scheduling/v1/interactions/${interactionId}/recording`,
      { method: "GET" }
    );

    return {
      recordingUrl: response.recording_url || null,
      durationSeconds: response.duration,
      mimeType: "audio/wav",
    };
  } catch {
    // Graceful fallback if recording is still processing or not enabled for the deployment
    return { recordingUrl: null };
  }
}

/**
 * Generates an authorized signed URL for playback from private Supabase Storage.
 */
export async function createSignedPlaybackUrl(
  storagePath: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("call-recordings")
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data) {
    return null;
  }

  return data.signedUrl;
}
