import { createClient } from "@/lib/supabase/server";
import type { CallStatus, CallOutcome } from "@/lib/supabase/types";

export interface ListCallsFilters {
  businessId: string;
  campaignId?: string;
  status?: CallStatus;
  outcome?: CallOutcome;
  search?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}

export interface CallListItem {
  id: string;
  campaign_id: string;
  campaign_name: string;
  contact_id: string;
  contact_name: string;
  contact_phone: string;
  status: CallStatus;
  outcome: CallOutcome | null;
  duration_seconds: number;
  interest_level: string | null;
  short_summary: string | null;
  has_recording: boolean;
  created_at: string;
}

export interface CallDetailResult {
  call: {
    id: string;
    campaign_id: string | null;
    contact_id: string;
    business_id: string;
    status: CallStatus;
    outcome: CallOutcome | null;
    duration_seconds: number;
    interest_level: string | null;
    short_summary: string | null;
    provider_call_id: string | null;
    provider_attempt_id: string | null;
    started_at: string | null;
    ended_at: string | null;
    created_at: string;
  };
  contact: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    city: string | null;
    is_dnc: boolean;
    is_wrong_number: boolean;
    tags: string[];
  } | null;
  campaign: {
    id: string;
    name: string;
    offering_type: string | null;
  } | null;
  attempts: Array<{
    id: string;
    attempt_number: number;
    status: string;
    failure_reason: string | null;
    duration_seconds: number;
    provider_attempt_id: string | null;
    retry_metadata: Record<string, unknown>;
    created_at: string;
  }>;
  transcript: {
    id: string;
    transcript_text: string;
    transcript_json: Array<{
      role: string;
      en_text: string;
      indic_text?: string;
      start_timestamp?: number;
      end_timestamp?: number;
    }>;
    language: string | null;
  } | null;
  analysis: {
    id: string;
    summary: string | null;
    objections: string[];
    questions: string[];
    intent: string | null;
    action_items: string | null;
  } | null;
  recording: {
    id: string;
    storage_path: string;
    duration_seconds: number | null;
    mime_type: string | null;
  } | null;
  callback: {
    id: string;
    scheduled_for: string;
    status: string;
    notes: string | null;
  } | null;
}

/**
 * Lists calls with multi-factor filtering, search, and pagination.
 */
export async function listCalls({
  businessId,
  campaignId,
  status,
  outcome,
  search,
  fromDate,
  toDate,
  page = 1,
  pageSize = 25,
}: ListCallsFilters): Promise<{ calls: CallListItem[]; total: number }> {
  const supabase = await createClient();

  let query = supabase
    .from("calls")
    .select(
      `
      id,
      campaign_id,
      contact_id,
      status,
      outcome,
      duration_seconds,
      interest_level,
      short_summary,
      created_at,
      contacts (name, phone),
      campaigns (name),
      call_recordings (id)
    `,
      { count: "exact" }
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (campaignId) {
    query = query.eq("campaign_id", campaignId);
  }

  if (status) {
    query = query.eq("status", status);
  }

  if (outcome) {
    query = query.eq("outcome", outcome);
  }

  if (fromDate) {
    query = query.gte("created_at", fromDate);
  }

  if (toDate) {
    query = query.lte("created_at", toDate);
  }

  const offset = (page - 1) * pageSize;
  const { data, count } = await query.range(offset, offset + pageSize - 1);

  type RawCallQueryResult = {
    id: string;
    campaign_id: string;
    contact_id: string;
    status: CallStatus;
    outcome: CallOutcome | null;
    duration_seconds: number;
    interest_level: string | null;
    short_summary: string | null;
    created_at: string;
    contacts: { name: string; phone: string } | { name: string; phone: string }[] | null;
    campaigns: { name: string } | { name: string }[] | null;
    call_recordings: { id: string }[] | null;
  };

  const calls: CallListItem[] = ((data as unknown as RawCallQueryResult[]) || []).map((row) => {
    const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
    const campaign = Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns;
    const recordings = Array.isArray(row.call_recordings) ? row.call_recordings : [];

    return {
      id: row.id,
      campaign_id: row.campaign_id,
      campaign_name: campaign?.name || "Untitled Campaign",
      contact_id: row.contact_id,
      contact_name: contact?.name || "Unknown",
      contact_phone: contact?.phone || "",
      status: row.status,
      outcome: row.outcome,
      duration_seconds: row.duration_seconds || 0,
      interest_level: row.interest_level,
      short_summary: row.short_summary,
      has_recording: recordings.length > 0,
      created_at: row.created_at,
    };
  });

  if (search) {
    const lower = search.toLowerCase();
    const filtered = calls.filter(
      (c) =>
        c.contact_name.toLowerCase().includes(lower) ||
        c.contact_phone.includes(lower) ||
        c.campaign_name.toLowerCase().includes(lower)
    );
    return { calls: filtered, total: filtered.length };
  }

  return { calls, total: count || 0 };
}

/**
 * Assembles complete call detail record including transcripts, audio references,
 * attempt timelines, and AI analysis.
 */
export async function getCallDetail(
  callId: string,
  businessId: string
): Promise<CallDetailResult | null> {
  const supabase = await createClient();

  // 1. Fetch main call
  const { data: call } = await supabase
    .from("calls")
    .select("*")
    .eq("id", callId)
    .eq("business_id", businessId)
    .single();

  if (!call) {
    return null;
  }

  // 2. Fetch Contact
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, name, phone, email, city, is_dnc, is_wrong_number, tags")
    .eq("id", call.contact_id)
    .single();

  // 3. Fetch Campaign
  let campaign = null;
  if (call.campaign_id) {
    const { data: c } = await supabase
      .from("campaigns")
      .select("id, name, offering_type")
      .eq("id", call.campaign_id)
      .maybeSingle();
    campaign = c;
  }

  // 4. Fetch Attempts
  const { data: attempts } = await supabase
    .from("call_attempts")
    .select("*")
    .eq("call_id", callId)
    .order("attempt_number", { ascending: true });

  // 5. Fetch Transcript
  const { data: transcript } = await supabase
    .from("call_transcripts")
    .select("*")
    .eq("call_id", callId)
    .maybeSingle();

  // 6. Fetch Analysis
  const { data: analysis } = await supabase
    .from("call_analysis")
    .select("*")
    .eq("call_id", callId)
    .maybeSingle();

  // 7. Fetch Recording
  const { data: recording } = await supabase
    .from("call_recordings")
    .select("*")
    .eq("call_id", callId)
    .maybeSingle();

  // 8. Fetch Scheduled Callback
  const { data: callback } = await supabase
    .from("callbacks")
    .select("*")
    .eq("call_id", callId)
    .maybeSingle();

  return {
    call: {
      id: call.id,
      campaign_id: call.campaign_id,
      contact_id: call.contact_id,
      business_id: call.business_id,
      status: call.status as CallStatus,
      outcome: call.outcome as CallOutcome | null,
      duration_seconds: call.duration_seconds,
      interest_level: call.interest_level,
      short_summary: call.short_summary,
      provider_call_id: call.provider_call_id,
      provider_attempt_id: call.provider_attempt_id,
      started_at: call.started_at,
      ended_at: call.ended_at,
      created_at: call.created_at,
    },
    contact: contact
      ? {
          id: contact.id,
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
          city: contact.city,
          is_dnc: contact.is_dnc,
          is_wrong_number: contact.is_wrong_number,
          tags: contact.tags || [],
        }
      : null,
    campaign: campaign
      ? {
          id: campaign.id,
          name: campaign.name,
          offering_type: campaign.offering_type,
        }
      : null,
    attempts: (attempts || []).map((a) => ({
      id: a.id,
      attempt_number: a.attempt_number,
      status: a.status,
      failure_reason: a.failure_reason,
      duration_seconds: a.duration_seconds,
      provider_attempt_id: a.provider_attempt_id,
      retry_metadata: (a.retry_metadata as Record<string, unknown>) || {},
      created_at: a.created_at,
    })),
    transcript: transcript
      ? {
          id: transcript.id,
          transcript_text: transcript.transcript_text,
          transcript_json:
            (transcript.transcript_json as unknown as Array<{
              role: string;
              en_text: string;
              indic_text?: string;
              start_timestamp?: number;
              end_timestamp?: number;
            }>) || [],
          language: transcript.language,
        }
      : null,
    analysis: analysis
      ? {
          id: analysis.id,
          summary: analysis.short_summary,
          objections: analysis.objections || [],
          questions: analysis.questions_asked || [],
          intent: analysis.customer_intent,
          action_items: analysis.recommended_next_action,
        }
      : null,
    recording: recording
      ? {
          id: recording.id,
          storage_path: recording.storage_path,
          duration_seconds: recording.duration_seconds,
          mime_type: recording.mime_type,
        }
      : null,
    callback: callback
      ? {
          id: callback.id,
          scheduled_for: callback.scheduled_for,
          status: callback.status,
          notes: callback.notes,
        }
      : null,
  };
}
