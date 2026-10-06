/**
 * @deprecated Legacy Sarvam client kept for type compatibility only.
 *
 * The `/telephony/*` endpoints modelled here are not part of the current Sarvam
 * Voice Agents API. Use `lib/providers/sarvam` (the scheduling API client) for
 * campaign, cohort and lifecycle operations. See docs/sarvam-integration.md.
 */
import {
  VoiceProvider,
  SarvamAgentConfig,
  SarvamAgentResponse,
  SarvamCampaignConfig,
  SarvamCampaignResponse,
  SarvamCallPayload,
  SarvamCallResponse,
} from "./types";
import { env } from "@/lib/env";
import { verifyHmacSha256 } from "@/lib/security/webhook-signature";

export class SarvamClient implements VoiceProvider {
  public readonly name = "sarvam";
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || env.SARVAM_API_KEY || "";
    this.baseUrl = baseUrl || env.SARVAM_BASE_URL || "https://apps.sarvam.ai";

    if (typeof window !== "undefined") {
      throw new Error("SECURITY VIOLATION: SarvamClient must never be instantiated on the client side.");
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.apiKey) {
      throw new Error("SARVAM_API_KEY is not configured.");
    }

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": this.apiKey,
        ...options.headers,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Sarvam API Error [${res.status}]: ${errorText}`);
    }

    return res.json() as Promise<T>;
  }

  async createAgent(config: SarvamAgentConfig): Promise<SarvamAgentResponse> {
    return this.request<SarvamAgentResponse>("/telephony/agents", {
      method: "POST",
      body: JSON.stringify(config),
    });
  }

  async createCampaign(config: SarvamCampaignConfig): Promise<SarvamCampaignResponse> {
    return this.request<SarvamCampaignResponse>("/telephony/campaigns", {
      method: "POST",
      body: JSON.stringify(config),
    });
  }

  async startCampaign(campaignId: string): Promise<boolean> {
    await this.request(`/telephony/campaigns/${campaignId}/start`, {
      method: "POST",
    });
    return true;
  }

  async pauseCampaign(campaignId: string): Promise<boolean> {
    await this.request(`/telephony/campaigns/${campaignId}/pause`, {
      method: "POST",
    });
    return true;
  }

  async resumeCampaign(campaignId: string): Promise<boolean> {
    await this.request(`/telephony/campaigns/${campaignId}/resume`, {
      method: "POST",
    });
    return true;
  }

  async initiateCall(payload: SarvamCallPayload): Promise<SarvamCallResponse> {
    return this.request<SarvamCallResponse>("/telephony/calls", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async fetchTranscript(callId: string): Promise<string | null> {
    try {
      const res = await this.request<{ transcript: string }>(`/telephony/calls/${callId}/transcript`);
      return res.transcript || null;
    } catch {
      return null;
    }
  }

  async fetchRecordingSignedUrl(recordingId: string): Promise<string | null> {
    try {
      const res = await this.request<{ download_url: string }>(`/telephony/recordings/${recordingId}/url`);
      return res.download_url || null;
    } catch {
      return null;
    }
  }

  verifyWebhookSignature(headers: Headers, rawBody: string): boolean {
    const signature =
      headers.get("x-sarvam-signature") ||
      headers.get("x-sarvam-webhook-signature");
    const secret = env.SARVAM_WEBHOOK_SECRET;

    if (!secret || /mock|placeholder|your-/i.test(secret)) {
      return (
        process.env.NODE_ENV !== "production" &&
        process.env.SARVAM_MOCK_MODE === "true"
      );
    }

    return verifyHmacSha256(rawBody, signature, secret);
  }
}

export const sarvamProvider = new SarvamClient();
