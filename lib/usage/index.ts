import type { Database } from "@/lib/supabase/types";

export type UsageEvent = Database["public"]["Tables"]["usage_events"]["Row"];
export type UsageEventInsert = Database["public"]["Tables"]["usage_events"]["Insert"];

export type UsageMetric =
  | "voice_minutes"
  | "outbound_calls"
  | "inbound_calls"
  | "recording_storage_mb"
  | "ai_analysis_calls";
