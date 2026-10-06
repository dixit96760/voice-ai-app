import { createClient } from "@/lib/supabase/server";

export interface BusinessUsageSummary {
  businessId: string;
  totalOutboundAttempts: number;
  totalDurationSeconds: number;
  totalDurationMinutes: number;
  totalRecordingsCount: number;
  totalAiAnalysisCount: number;
  recentEvents: Array<{
    id: string;
    event_type: string;
    quantity: number;
    unit: string;
    created_at: string;
    campaign_id: string | null;
  }>;
}

/**
 * Aggregates billable usage events for a business across telephony, voice minutes,
 * recording storage, and AI analysis.
 */
export async function getBusinessUsageSummary(
  businessId: string,
  fromDate?: string,
  toDate?: string
): Promise<BusinessUsageSummary> {
  const supabase = await createClient();

  let totalOutboundAttempts = 0;
  let totalDurationSeconds = 0;
  let totalRecordingsCount = 0;
  let totalAiAnalysisCount = 0;

  // 1. Database-side aggregation via RPC (unbounded by row limits)
  const { data: rpcAggregates, error: rpcError } = await supabase.rpc(
    "get_business_usage_aggregates",
    {
      p_business_id: businessId,
      p_from_date: fromDate || undefined,
      p_to_date: toDate || undefined,
    }
  );

  if (!rpcError && rpcAggregates) {
    for (const agg of rpcAggregates) {
      const qty = Number(agg.total_quantity) || 0;
      if (agg.event_type === "OUTBOUND_CALL_ATTEMPT") {
        totalOutboundAttempts = qty;
      } else if (agg.event_type === "CALL_DURATION") {
        totalDurationSeconds = qty;
      } else if (agg.event_type === "RECORDING_STORED") {
        totalRecordingsCount = qty;
      } else if (agg.event_type === "AI_ANALYSIS") {
        totalAiAnalysisCount = qty;
      }
    }
  } else {
    // Fallback: in test environments or if RPC is unavailable, aggregate directly
    let fallbackQuery = supabase
      .from("usage_events")
      .select("event_type, quantity")
      .eq("business_id", businessId);

    if (fromDate) {
      fallbackQuery = fallbackQuery.gte("created_at", fromDate);
    }
    if (toDate) {
      fallbackQuery = fallbackQuery.lte("created_at", toDate);
    }

    const { data: fallbackEvents } = await fallbackQuery;
    for (const ev of fallbackEvents || []) {
      const qty = Number(ev.quantity) || 0;
      if (ev.event_type === "OUTBOUND_CALL_ATTEMPT") {
        totalOutboundAttempts += qty;
      } else if (ev.event_type === "CALL_DURATION") {
        totalDurationSeconds += qty;
      } else if (ev.event_type === "RECORDING_STORED") {
        totalRecordingsCount += qty;
      } else if (ev.event_type === "AI_ANALYSIS") {
        totalAiAnalysisCount += qty;
      }
    }
  }

  // 2. Also query call_recordings count directly as secondary source of truth
  const { count: recordingsCount } = await supabase
    .from("calls")
    .select("id, call_recordings!inner(id)", { count: "exact", head: true })
    .eq("business_id", businessId);

  // 3. Also query call_analysis count directly as secondary source of truth
  const { count: analysisCount } = await supabase
    .from("calls")
    .select("id, call_analysis!inner(id)", { count: "exact", head: true })
    .eq("business_id", businessId);

  // 4. Fetch recent 50 events for UI display only (never used for calculating totals)
  let recentQuery = supabase
    .from("usage_events")
    .select("id, event_type, quantity, unit, created_at, campaign_id")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (fromDate) {
    recentQuery = recentQuery.gte("created_at", fromDate);
  }
  if (toDate) {
    recentQuery = recentQuery.lte("created_at", toDate);
  }

  const { data: recentEvents } = await recentQuery;

  return {
    businessId,
    totalOutboundAttempts: Math.max(totalOutboundAttempts, 0),
    totalDurationSeconds,
    totalDurationMinutes: Math.ceil(totalDurationSeconds / 60),
    totalRecordingsCount: Math.max(totalRecordingsCount, recordingsCount || 0),
    totalAiAnalysisCount: Math.max(totalAiAnalysisCount, analysisCount || 0),
    recentEvents: recentEvents || [],
  };
}
