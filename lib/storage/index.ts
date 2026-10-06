/**
 * Secure Storage Provider Abstraction
 * Handles private buckets, signed URLs, and file retention policies.
 */

export const STORAGE_BUCKETS = {
  CAMPAIGN_SOURCES: "campaign-sources",
  RECORDINGS: "call-recordings",
  EXPORTS: "data-exports",
  LOGOS: "business-logos",
} as const;

export interface StorageFileDescriptor {
  bucket: keyof typeof STORAGE_BUCKETS;
  path: string;
  contentType: string;
  sizeBytes: number;
}
