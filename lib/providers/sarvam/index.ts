export * from "./types";
export * from "./errors";
export * from "./config";
export * from "./client";
export * from "./agent";
export * from "./campaign";
export * from "./cohort";
export * from "./webhooks";
export * from "./recordings";

import {
  createSarvamCampaign,
  pauseSarvamCampaign,
  resumeSarvamCampaign,
  cancelSarvamCampaign,
  getSarvamCampaign,
  listSarvamCampaigns,
} from "./campaign";
import { streamSarvamCohort, getSarvamCohort } from "./cohort";
import { downloadSarvamRecording, type SarvamRecordingAudio } from "./recordings";
import type {
  SarvamCampaignRequest,
  SarvamCampaignResponse,
  SarvamCampaignListResponse,
  SarvamCohortResponse,
  SarvamStatusUpdateResponse,
} from "./types";
import type { StreamCohortParams, StreamCohortResult } from "./cohort";

/**
 * VoiceProvider Abstract Interface
 * Enables clean provider decoupling throughout the SaaS platform.
 */
export interface VoiceProvider {
  createCampaign(params: SarvamCampaignRequest): Promise<SarvamCampaignResponse>;
  pauseCampaign(campaignId: string): Promise<SarvamStatusUpdateResponse>;
  resumeCampaign(campaignId: string): Promise<SarvamStatusUpdateResponse>;
  cancelCampaign(campaignId: string): Promise<SarvamStatusUpdateResponse>;
  getCampaign(campaignId: string): Promise<SarvamCampaignResponse>;
  listCampaigns(options?: {
    status?: string;
    limit?: number;
    search?: string;
  }): Promise<SarvamCampaignListResponse>;
  streamCohort(params: StreamCohortParams): Promise<StreamCohortResult>;
  getCohort(campaignId: string, cohortId: string): Promise<SarvamCohortResponse>;
  downloadRecording(appId: string, interactionId: string): Promise<SarvamRecordingAudio | null>;
}

export const SarvamVoiceProvider: VoiceProvider = {
  createCampaign: createSarvamCampaign,
  pauseCampaign: pauseSarvamCampaign,
  resumeCampaign: resumeSarvamCampaign,
  cancelCampaign: cancelSarvamCampaign,
  getCampaign: getSarvamCampaign,
  listCampaigns: listSarvamCampaigns,
  streamCohort: streamSarvamCohort,
  getCohort: getSarvamCohort,
  downloadRecording: downloadSarvamRecording,
};
