import * as XLSX from "xlsx";
import { ImportPreviewRow } from "./types";

/**
 * Parses raw CSV content into array of record objects.
 * Handles quoted fields, commas inside quotes, CRLF, and escaped quotes.
 */
export function parseCsvText(csvText: string): ImportPreviewRow[] {
  if (!csvText || !csvText.trim()) {
    return [];
  }

  const lines: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentField.trim());
        currentField = "";
      } else if (char === "\r" || char === "\n") {
        currentRow.push(currentField.trim());
        if (currentRow.some((val) => val.length > 0)) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentField = "";
        if (char === "\r" && nextChar === "\n") {
          i++;
        }
      } else {
        currentField += char;
      }
    }
  }

  // Handle trailing row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((val) => val.length > 0)) {
      lines.push(currentRow);
    }
  }

  if (lines.length < 2) {
    return [];
  }

  const rawHeaders = lines[0].map((h) => h.trim());
  const rows: ImportPreviewRow[] = [];

  for (let r = 1; r < lines.length; r++) {
    const line = lines[r];
    const rowObj: ImportPreviewRow = {};
    let hasAnyData = false;

    for (let c = 0; c < rawHeaders.length; c++) {
      const header = rawHeaders[c] || `Column_${c + 1}`;
      const val = line[c] !== undefined ? line[c].trim() : "";
      if (val) hasAnyData = true;
      rowObj[header] = val;
    }

    if (hasAnyData) {
      rows.push(rowObj);
    }
  }

  return rows;
}

/**
 * Parses an Excel file (.xlsx or .xls) from a Buffer or ArrayBuffer into rows.
 */
export function parseExcelBuffer(buffer: Buffer | ArrayBuffer): ImportPreviewRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [];
  }

  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) {
    return [];
  }

  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
    raw: false,
  });

  return jsonData.map((row) => {
    const formatted: ImportPreviewRow = {};
    for (const [key, val] of Object.entries(row)) {
      formatted[key.trim()] = val !== undefined && val !== null ? String(val).trim() : "";
    }
    return formatted;
  });
}

/**
 * Normalizes Google Sheets URL into public CSV export URL if possible.
 */
export function normalizeGoogleSheetsUrl(inputUrl: string): string {
  const url = inputUrl.trim();
  // Matches https://docs.google.com/spreadsheets/d/{spreadsheetId}/...
  const match = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    return url;
  }

  const spreadsheetId = match[1];
  // Extract gid (sheet tab) if present
  const gidMatch = url.match(/gid=([0-9]+)/);
  const gidParam = gidMatch ? `&gid=${gidMatch[1]}` : "";

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${gidParam}`;
}
