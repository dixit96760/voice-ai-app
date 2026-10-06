import type { Database } from "@/lib/supabase/types";

export type Contact = Database["public"]["Tables"]["contacts"]["Row"];
export type ContactInsert = Database["public"]["Tables"]["contacts"]["Insert"];
export type ContactUpdate = Database["public"]["Tables"]["contacts"]["Update"];
export type ContactImport = Database["public"]["Tables"]["contact_imports"]["Row"];

export type ImportSourceType = "CSV" | "EXCEL" | "GOOGLE_SHEETS" | "MANUAL";
export type ImportStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
export type DeduplicationStrategy = "SKIP" | "OVERWRITE";

export interface ColumnMapping {
  phone: string; // Source column name
  name: string;
  email?: string;
  city?: string;
  tags?: string;
  [customField: string]: string | undefined;
}

export interface ImportPreviewRow {
  [sourceHeader: string]: string | number | boolean | null;
}

export interface ImportPreview {
  headers: string[];
  suggestedMapping: ColumnMapping;
  sampleRows: ImportPreviewRow[];
  totalEstimatedRows: number;
}

export interface ImportErrorDetail {
  row: number;
  phone?: string;
  name?: string;
  error: string;
}

export interface ImportExecutionResult {
  importId: string;
  status: ImportStatus;
  totalRows: number;
  importedCount: number;
  duplicateCount: number;
  dncFilteredCount: number;
  wrongNumberFilteredCount: number;
  invalidCount: number;
  errors: ImportErrorDetail[];
}

export interface ManualContactInput {
  name: string;
  phone: string;
  email?: string;
  city?: string;
  tags?: string[];
  notes?: string;
  custom_fields?: Record<string, unknown>;
}
