"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireBusiness } from "@/lib/auth/session";
import { normalizeIndianPhone } from "@/lib/validation/phone";
import {
  ColumnMapping,
  DeduplicationStrategy,
  ImportExecutionResult,
  ImportPreview,
  ManualContactInput,
} from "./types";
import { parseCsvText, parseExcelBuffer, normalizeGoogleSheetsUrl } from "./parser";
import { suggestColumnMapping, validateColumnMapping } from "./mapper";
import { executeContactImport } from "./import-service";
import type { Json } from "@/lib/supabase/types";

import { ImportPreviewRow } from "./types";


async function getAuthenticatedBusiness() {
  const { user, business } = await requireBusiness();
  const supabase = await createClient();
  return { supabase, user, business };
}

/**
 * Creates a single manual contact.
 */
export async function createManualContactAction(
  input: ManualContactInput
): Promise<{ success: boolean; contactId?: string; error?: string }> {
  try {
    const { supabase, business } = await getAuthenticatedBusiness();

    const norm = normalizeIndianPhone(input.phone);
    if (!norm.isValid || !norm.normalized) {
      return { success: false, error: "Please provide a valid Indian 10-digit mobile number." };
    }

    // Check if phone already exists
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("business_id", business.id)
      .eq("phone", norm.normalized)
      .maybeSingle();

    if (existing) {
      return { success: false, error: "A contact with this phone number already exists." };
    }

    // Check DNC status
    const { data: dnc } = await supabase
      .from("dnc_numbers")
      .select("id")
      .eq("business_id", business.id)
      .eq("phone_number", norm.normalized)
      .maybeSingle();

    const isDnc = !!dnc;

    const { data: newContact, error: insertError } = await supabase
      .from("contacts")
      .insert({
        business_id: business.id,
        name: input.name.trim(),
        phone: norm.normalized,
        email: input.email?.trim() || null,
        city: input.city?.trim() || null,
        tags: input.tags || [],
        notes: input.notes || null,
        status: isDnc ? "DNC" : "ACTIVE",
        is_dnc: isDnc,
        is_wrong_number: false,
      })
      .select("id")
      .single();

    if (insertError || !newContact) {
      return { success: false, error: insertError?.message || "Failed to create contact." };
    }

    revalidatePath("/contacts");
    return { success: true, contactId: newContact.id };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Uploads a file (CSV or XLSX) and prepares a column-mapping preview.
 */
export async function uploadAndPreviewContactFileAction(
  formData: FormData
): Promise<{ success: boolean; preview?: ImportPreview; importId?: string; error?: string }> {
  try {
    const { supabase, user, business } = await getAuthenticatedBusiness();

    const file = formData.get("file") as File;
    if (!file) {
      return { success: false, error: "No file uploaded." };
    }

    if (file.size > 10 * 1024 * 1024) {
      return { success: false, error: "File exceeds maximum size limit of 10MB." };
    }

    const fileName = file.name;
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
    const isCsv = fileName.endsWith(".csv");

    if (!isExcel && !isCsv) {
      return { success: false, error: "Only .csv and .xlsx files are supported." };
    }

    let rows: ImportPreviewRow[] = [];
    if (isExcel) {
      const buffer = await file.arrayBuffer();
      rows = parseExcelBuffer(buffer);
    } else {
      const text = await file.text();
      rows = parseCsvText(text);
    }

    if (rows.length === 0) {
      return { success: false, error: "No valid contact rows found in uploaded file." };
    }

    const headers = Object.keys(rows[0] || {});
    const suggestedMapping = suggestColumnMapping(headers);

    // Create a contact_imports record
    const { data: importRec, error: dbError } = await supabase
      .from("contact_imports")
      .insert({
        business_id: business.id,
        user_id: user.id,
        source_type: isExcel ? "EXCEL" : "CSV",
        file_name: fileName,
        status: "PENDING",
        total_rows: rows.length,
        column_mapping: suggestedMapping as unknown as Json,
      })
      .select("id")
      .single();

    if (dbError || !importRec) {
      return { success: false, error: "Failed to initialize import session." };
    }

    // Stage rows in private Supabase Storage bucket for multi-instance serverless resilience
    const storagePath = `${business.id}/${importRec.id}.json`;
    const { error: storageError } = await supabase.storage
      .from("contact-imports")
      .upload(storagePath, JSON.stringify(rows), {
        contentType: "application/json",
        upsert: true,
      });

    if (storageError) {
      console.error("Storage upload error for contact import:", storageError);
      return { success: false, error: "Failed to stage import file in secure storage." };
    }

    // Update import record with storage_path
    await supabase
      .from("contact_imports")
      .update({ storage_path: storagePath })
      .eq("id", importRec.id);

    return {
      success: true,
      importId: importRec.id,
      preview: {
        headers,
        suggestedMapping,
        sampleRows: rows.slice(0, 5),
        totalEstimatedRows: rows.length,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Fetches and previews a public Google Sheet.
 */
export async function importGoogleSheetPreviewAction(
  sheetUrl: string
): Promise<{ success: boolean; preview?: ImportPreview; importId?: string; error?: string }> {
  try {
    const { supabase, user, business } = await getAuthenticatedBusiness();

    const csvUrl = normalizeGoogleSheetsUrl(sheetUrl);
    const response = await fetch(csvUrl);
    if (!response.ok) {
      return {
        success: false,
        error:
          "Unable to access Google Sheet. Please make sure the sheet is public or shared via link with 'Anyone with the link can view'.",
      };
    }

    const text = await response.text();
    const rows = parseCsvText(text);

    if (rows.length === 0) {
      return { success: false, error: "No contact records found in this Google Sheet." };
    }

    const headers = Object.keys(rows[0] || {});
    const suggestedMapping = suggestColumnMapping(headers);

    const { data: importRec, error: dbError } = await supabase
      .from("contact_imports")
      .insert({
        business_id: business.id,
        user_id: user.id,
        source_type: "GOOGLE_SHEETS",
        file_name: "Google Sheets Import",
        status: "PENDING",
        total_rows: rows.length,
        column_mapping: suggestedMapping as unknown as Json,
      })
      .select("id")
      .single();

    if (dbError || !importRec) {
      return { success: false, error: "Failed to initialize Google Sheet import." };
    }

    // Stage rows in private Supabase Storage bucket for multi-instance serverless resilience
    const storagePath = `${business.id}/${importRec.id}.json`;
    const { error: storageError } = await supabase.storage
      .from("contact-imports")
      .upload(storagePath, JSON.stringify(rows), {
        contentType: "application/json",
        upsert: true,
      });

    if (storageError) {
      console.error("Storage upload error for Google Sheet import:", storageError);
      return { success: false, error: "Failed to stage import file in secure storage." };
    }

    // Update import record with storage_path
    await supabase
      .from("contact_imports")
      .update({ storage_path: storagePath })
      .eq("id", importRec.id);

    return {
      success: true,
      importId: importRec.id,
      preview: {
        headers,
        suggestedMapping,
        sampleRows: rows.slice(0, 5),
        totalEstimatedRows: rows.length,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Executes a configured contact import.
 */
export async function executeImportAction(
  importId: string,
  mapping: ColumnMapping,
  deduplicationStrategy: DeduplicationStrategy
): Promise<{ success: boolean; result?: ImportExecutionResult; error?: string }> {
  try {
    const { business, user, supabase } = await getAuthenticatedBusiness();

    // 1. Fetch import session from database to retrieve storage_path and enforce business ownership
    const { data: importRec, error: fetchErr } = await supabase
      .from("contact_imports")
      .select("id, business_id, storage_path, status")
      .eq("id", importId)
      .eq("business_id", business.id)
      .single();

    if (fetchErr || !importRec || !importRec.storage_path) {
      return {
        success: false,
        error: "Import session expired or not found. Please upload the file again.",
      };
    }

    // 2. Download staged rows from private Supabase Storage bucket
    const { data: fileBlob, error: downloadErr } = await supabase.storage
      .from("contact-imports")
      .download(importRec.storage_path);

    if (downloadErr || !fileBlob) {
      console.error("Failed to download staged import file:", downloadErr);
      return {
        success: false,
        error: "Import session data expired. Please upload the file again.",
      };
    }

    const jsonText = await fileBlob.text();
    let rows: ImportPreviewRow[] = [];
    try {
      rows = JSON.parse(jsonText);
    } catch {
      return {
        success: false,
        error: "Failed to parse staged import data. Please re-upload your file.",
      };
    }

    if (!rows || rows.length === 0) {
      return {
        success: false,
        error: "Import session contained no records. Please upload the file again.",
      };
    }

    const validation = validateColumnMapping(Object.keys(rows[0] || {}), mapping);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(", ") };
    }

    const result = await executeContactImport({
      importId,
      businessId: business.id,
      userId: user.id,
      rows,
      mapping,
      deduplicationStrategy,
    });

    // 3. Delete staged data after import completes to ensure security and cleanup
    await supabase.storage
      .from("contact-imports")
      .remove([importRec.storage_path]);

    revalidatePath("/contacts");
    revalidatePath("/contacts/imports");

    return { success: true, result };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Toggles a contact's DNC status and maintains the business-wide DNC list.
 */
export async function toggleContactDncAction(
  contactId: string,
  isDnc: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, business } = await getAuthenticatedBusiness();

    const { data: contact } = await supabase
      .from("contacts")
      .select("id, phone")
      .eq("id", contactId)
      .eq("business_id", business.id)
      .single();

    if (!contact) {
      return { success: false, error: "Contact not found." };
    }

    await supabase
      .from("contacts")
      .update({
        is_dnc: isDnc,
        status: isDnc ? "DNC" : "ACTIVE",
        updated_at: new Date().toISOString(),
      })
      .eq("id", contactId);

    if (isDnc) {
      await supabase.from("dnc_numbers").upsert(
        {
          business_id: business.id,
          phone_number: contact.phone,
          reason: "manual",
        },
        { onConflict: "business_id,phone_number" }
      );
    } else {
      await supabase
        .from("dnc_numbers")
        .delete()
        .eq("business_id", business.id)
        .eq("phone_number", contact.phone);
    }

    revalidatePath("/contacts");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Toggles a contact's wrong-number flag (strictly independent of DNC).
 */
export async function toggleContactWrongNumberAction(
  contactId: string,
  isWrongNumber: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, business } = await getAuthenticatedBusiness();

    await supabase
      .from("contacts")
      .update({
        is_wrong_number: isWrongNumber,
        status: isWrongNumber ? "WRONG_NUMBER" : "ACTIVE",
        updated_at: new Date().toISOString(),
      })
      .eq("id", contactId)
      .eq("business_id", business.id);

    revalidatePath("/contacts");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  }
}
