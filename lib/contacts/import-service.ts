import { createClient } from "@/lib/supabase/server";
import { normalizeIndianPhone } from "@/lib/validation/phone";
import {
  ColumnMapping,
  DeduplicationStrategy,
  ImportErrorDetail,
  ImportExecutionResult,
  ImportPreviewRow,
} from "./types";
import type { Json } from "@/lib/supabase/types";

export interface ExecuteImportOptions {
  importId: string;
  businessId: string;
  userId?: string;
  rows: ImportPreviewRow[];
  mapping: ColumnMapping;
  deduplicationStrategy: DeduplicationStrategy;
}

/**
 * Executes high-volume contact import with validation, phone normalization,
 * DNC/wrong-number detection, and duplicate resolution.
 */
export async function executeContactImport({
  importId,
  businessId,
  rows,
  mapping,
  deduplicationStrategy,
}: ExecuteImportOptions): Promise<ImportExecutionResult> {
  const supabase = await createClient();

  // Mark import job as PROCESSING
  await supabase
    .from("contact_imports")
    .update({
      status: "PROCESSING",
      total_rows: rows.length,
      column_mapping: mapping as unknown as Json,
    })
    .eq("id", importId);

  // 1. Fetch business DNC list for filtering
  const { data: dncRecords } = await supabase
    .from("dnc_numbers")
    .select("phone_number")
    .eq("business_id", businessId);

  const dncSet = new Set<string>((dncRecords || []).map((r) => r.phone_number));

  // 2. Fetch existing business contacts to resolve duplicates and wrong-numbers
  const { data: existingContacts } = await supabase
    .from("contacts")
    .select("id, phone, is_dnc, is_wrong_number")
    .eq("business_id", businessId);

  const existingPhoneMap = new Map<string, { id: string; is_dnc: boolean; is_wrong_number: boolean }>();
  for (const c of existingContacts || []) {
    existingPhoneMap.set(c.phone, c);
  }

  let importedCount = 0;
  let duplicateCount = 0;
  let dncFilteredCount = 0;
  let wrongNumberFilteredCount = 0;
  let invalidCount = 0;
  const errors: ImportErrorDetail[] = [];

  const toInsert: Array<{
    business_id: string;
    import_id: string;
    name: string;
    phone: string;
    email: string | null;
    city: string | null;
    tags: string[];
    status: string;
    is_dnc: boolean;
    is_wrong_number: boolean;
  }> = [];

  const toUpdate: Array<{
    id: string;
    name: string;
    email: string | null;
    city: string | null;
    tags: string[];
    import_id: string;
  }> = [];

  // 3. Process every row
  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rowNumber = idx + 1;

    const rawPhone = String(row[mapping.phone] || "").trim();
    const rawName = String(row[mapping.name] || "").trim();
    const email = mapping.email && row[mapping.email] ? String(row[mapping.email]).trim() : null;
    const city = mapping.city && row[mapping.city] ? String(row[mapping.city]).trim() : null;
    const rawTags = mapping.tags && row[mapping.tags] ? String(row[mapping.tags]).trim() : "";

    const tags = rawTags
      ? rawTags
          .split(/[,;|]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    if (!rawPhone) {
      invalidCount++;
      errors.push({ row: rowNumber, error: "Missing phone number" });
      continue;
    }

    const norm = normalizeIndianPhone(rawPhone);
    if (!norm.isValid || !norm.normalized) {
      invalidCount++;
      errors.push({
        row: rowNumber,
        phone: rawPhone,
        name: rawName,
        error: `Invalid Indian phone number: ${rawPhone}`,
      });
      continue;
    }

    const canonicalPhone = norm.normalized;
    const contactName = rawName || "Lead";

    // Check if phone is in DNC
    const isDnc = dncSet.has(canonicalPhone);
    if (isDnc) {
      dncFilteredCount++;
    }

    // Check existing contact
    const existing = existingPhoneMap.get(canonicalPhone);
    if (existing) {
      if (existing.is_wrong_number) {
        wrongNumberFilteredCount++;
      }

      if (deduplicationStrategy === "SKIP") {
        duplicateCount++;
        continue;
      } else {
        // OVERWRITE
        toUpdate.push({
          id: existing.id,
          name: contactName,
          email,
          city,
          tags,
          import_id: importId,
        });
        duplicateCount++;
        continue;
      }
    }

    // New unique contact
    toInsert.push({
      business_id: businessId,
      import_id: importId,
      name: contactName,
      phone: canonicalPhone,
      email,
      city,
      tags,
      status: isDnc ? "DNC" : "ACTIVE",
      is_dnc: isDnc,
      is_wrong_number: false,
    });
    // Add to existing phone map to handle duplicates within the same import file
    existingPhoneMap.set(canonicalPhone, {
      id: "pending",
      is_dnc: isDnc,
      is_wrong_number: false,
    });
  }

  // 4. Batch execute insertions (chunks of 500)
  const CHUNK_SIZE = 500;
  for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + CHUNK_SIZE);
    const { error: insertError } = await supabase.from("contacts").insert(chunk);
    if (insertError) {
      console.error("Batch contact insert error:", insertError);
      errors.push({ row: i, error: `Batch insert error: ${insertError.message}` });
    } else {
      importedCount += chunk.length;
    }
  }

  // 5. Execute updates
  for (const updateItem of toUpdate) {
    const { error: updateError } = await supabase
      .from("contacts")
      .update({
        name: updateItem.name,
        email: updateItem.email,
        city: updateItem.city,
        tags: updateItem.tags,
        import_id: updateItem.import_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", updateItem.id);

    if (!updateError) {
      importedCount++;
    }
  }

  // 6. Update contact_imports record
  const finalStatus: "COMPLETED" | "FAILED" =
    importedCount > 0 || rows.length === 0 ? "COMPLETED" : "FAILED";

  await supabase
    .from("contact_imports")
    .update({
      status: finalStatus,
      imported_count: importedCount,
      duplicate_count: duplicateCount,
      dnc_filtered_count: dncFilteredCount,
      wrong_number_filtered_count: wrongNumberFilteredCount,
      invalid_count: invalidCount,
      error_summary: errors.slice(0, 50) as unknown as Json, // cap stored errors
      completed_at: new Date().toISOString(),
    })
    .eq("id", importId);

  return {
    importId,
    status: finalStatus,
    totalRows: rows.length,
    importedCount,
    duplicateCount,
    dncFilteredCount,
    wrongNumberFilteredCount,
    invalidCount,
    errors,
  };
}
