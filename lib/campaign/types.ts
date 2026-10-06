import type { Database, CampaignStatus, CampaignSourceType } from "@/lib/supabase/types";

export type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];
export type CampaignInsert = Database["public"]["Tables"]["campaigns"]["Insert"];
export type CampaignUpdate = Database["public"]["Tables"]["campaigns"]["Update"];

export type CampaignVersion = Database["public"]["Tables"]["campaign_versions"]["Row"];
export type CampaignSource = Database["public"]["Tables"]["campaign_sources"]["Row"];

export { CampaignStatus, CampaignSourceType };
