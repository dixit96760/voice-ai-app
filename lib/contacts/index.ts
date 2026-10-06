import type { Database } from "@/lib/supabase/types";

export type Contact = Database["public"]["Tables"]["contacts"]["Row"];
export type ContactInsert = Database["public"]["Tables"]["contacts"]["Insert"];
export type CampaignContact = Database["public"]["Tables"]["campaign_contacts"]["Row"];
