import { createClient } from "@/lib/supabase/server";

/**
 * Escapes a CSV field adhering to RFC-4180 while preventing CSV Formula Injection (CWE-1236).
 * Any field starting with '=', '+', '-', or '@' is prefixed with an apostrophe (').
 */
export function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);

  // Neutralize CSV formula injection triggers: =, +, -, @
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }

  // RFC-4180: double-quote escaping and encapsulation
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Generates an RFC-4180 compliant CSV string of campaign calls.
 */
export async function generateCampaignCallsCsv(
  campaignId: string,
  businessId: string
): Promise<string> {
  const supabase = await createClient();

  const { data: calls } = await supabase
    .from("calls")
    .select(
      `
      id,
      status,
      outcome,
      duration_seconds,
      interest_level,
      short_summary,
      created_at,
      contacts (name, phone, city, email)
    `
    )
    .eq("campaign_id", campaignId)
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  const headers = [
    "Call ID",
    "Contact Name",
    "Phone Number",
    "Email",
    "City",
    "Status",
    "Outcome",
    "Duration (Seconds)",
    "Interest Level",
    "Summary",
    "Date (IST)",
  ];

  type CallExportRow = {
    id: string;
    status: string;
    outcome: string | null;
    duration_seconds: number;
    interest_level: string | null;
    short_summary: string | null;
    created_at: string;
    contacts: { name: string; phone: string; city: string | null; email: string | null } | { name: string; phone: string; city: string | null; email: string | null }[] | null;
  };

  const rows = ((calls as unknown as CallExportRow[]) || []).map((row) => {
    const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;

    return [
      escapeCsvField(row.id),
      escapeCsvField(contact?.name || "Lead"),
      escapeCsvField(contact?.phone || ""),
      escapeCsvField(contact?.email || ""),
      escapeCsvField(contact?.city || ""),
      escapeCsvField(row.status),
      escapeCsvField(row.outcome || ""),
      escapeCsvField(row.duration_seconds || 0),
      escapeCsvField(row.interest_level || ""),
      escapeCsvField(row.short_summary || ""),
      escapeCsvField(
        new Date(row.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
      ),
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\r\n");
}
