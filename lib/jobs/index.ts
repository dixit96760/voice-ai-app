export type JobType =
  | "CONTACT_IMPORT"
  | "FILE_PROCESSING"
  | "KNOWLEDGE_EXTRACTION"
  | "TRANSCRIPT_PROCESSING"
  | "AI_ANALYSIS"
  | "WEBHOOK_PROCESSING"
  | "RECORDING_CLEANUP"
  | "CALLBACK_SCHEDULING"
  | "USAGE_AGGREGATION";

export interface BackgroundJob<T = Record<string, unknown>> {
  id: string;
  type: JobType;
  businessId: string;
  payload: T;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  attempts: number;
  maxAttempts: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
