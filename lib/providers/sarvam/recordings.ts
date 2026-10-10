import { getSarvamBaseUrl, getSarvamScope, getSarvamVoiceAgentsApiKey } from "./config";

export interface SarvamRecordingAudio {
  audio: ArrayBuffer;
  contentType: string;
}

/**
 * Downloads the audio of a completed call from the Sarvam Analytics API.
 * Endpoint: GET /api/analytics/v1/:org_id/:workspace_id/:app_id/recordings/:interaction_id
 * The response body is the audio file itself (audio/wav), not a link.
 *
 * Returns null when the recording is not available (yet): it is produced a
 * short while after the call ends, and calls that never connected have none.
 */
export async function downloadSarvamRecording(
  appId: string,
  interactionId: string
): Promise<SarvamRecordingAudio | null> {
  if (!appId || !interactionId) return null;

  const { orgId, workspaceId } = getSarvamScope();
  const url = `${getSarvamBaseUrl()}/api/analytics/v1/${encodeURIComponent(orgId)}/${encodeURIComponent(
    workspaceId
  )}/${encodeURIComponent(appId)}/recordings/${encodeURIComponent(interactionId)}`;

  const response = await fetch(url, {
    headers: { "X-API-Key": getSarvamVoiceAgentsApiKey() },
    signal: AbortSignal.timeout(30_000),
  });

  const contentType = response.headers.get("content-type") || "";
  if (response.status === 404 || response.status === 422) return null;
  if (!response.ok) {
    throw new Error(`Sarvam recording download failed with HTTP ${response.status}.`);
  }
  if (!contentType.startsWith("audio/")) return null;

  const audio = await response.arrayBuffer();
  return audio.byteLength > 0 ? { audio, contentType } : null;
}
