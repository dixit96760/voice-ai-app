import type { Database, CallbackStatus } from "@/lib/supabase/types";

export type Callback = Database["public"]["Tables"]["callbacks"]["Row"];
export type CallbackInsert = Database["public"]["Tables"]["callbacks"]["Insert"];

export { CallbackStatus };
