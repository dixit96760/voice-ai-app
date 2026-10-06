import type { Database } from "@/lib/supabase/types";

export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];
export type AuditLogInsert = Database["public"]["Tables"]["audit_logs"]["Insert"];

export type AuditAction =
  | "CAMPAIGN_CREATED"
  | "CAMPAIGN_STARTED"
  | "CAMPAIGN_PAUSED"
  | "CAMPAIGN_RESUMED"
  | "CAMPAIGN_DELETED"
  | "CONTACT_IMPORTED"
  | "DNC_CREATED"
  | "PHONE_CONNECTED"
  | "SETTINGS_CHANGED"
  | "DATA_EXPORTED"
  | "RECORDING_ACCESSED"
  | "ACCOUNT_DELETION_REQUESTED";
