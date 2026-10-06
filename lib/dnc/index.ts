import type { Database, DncReason } from "@/lib/supabase/types";

export type DncNumber = Database["public"]["Tables"]["dnc_numbers"]["Row"];
export type DncNumberInsert = Database["public"]["Tables"]["dnc_numbers"]["Insert"];

export { DncReason };
