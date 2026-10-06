import { createClient } from "@/lib/supabase/server";

export interface CampaignFunnelMetrics {
  totalEnrolled: number;
  totalDialed: number;
  totalAnswered: number;
  totalInterested: number;
  totalCallbacks: number;
  connectionRatePercent: number;
  qualificationRatePercent: number;
}

export interface OutcomeDistribution {
  outcome: string;
  count: number;
  percentage: number;
}

export interface VoiceIntelligenceInsights {
  topObjections: Array<{ objection: string; count: number }>;
  topQuestions: Array<{ question: string; count: number }>;
  averageDurationSeconds: number;
  totalDurationMinutes: number;
}

export interface CampaignAnalyticsReport {
  campaignId: string;
  campaignName: string;
  funnel: CampaignFunnelMetrics;
  outcomes: OutcomeDistribution[];
  insights: VoiceIntelligenceInsights;
}

/**
 * Calculates complete campaign analytics, funnel conversion, and voice insights.
 */
export async function getCampaignAnalytics(
  campaignId: string,
  businessId: string
): Promise<CampaignAnalyticsReport | null> {
  const supabase = await createClient();

  // 1. Fetch Campaign
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, name")
    .eq("id", campaignId)
    .eq("business_id", businessId)
    .single();

  if (!campaign) {
    return null;
  }

  // 2. Fetch Enrolled Contacts Count
  const { count: enrolledCount } = await supabase
    .from("campaign_contacts")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  // 3. Fetch Calls for this campaign
  const { data: calls } = await supabase
    .from("calls")
    .select("id, status, outcome, duration_seconds, interest_level")
    .eq("campaign_id", campaignId)
    .eq("business_id", businessId);

  const callList = calls || [];
  const totalDialed = callList.length;

  const answeredCalls = callList.filter(
    (c) => c.status === "COMPLETED" || (c.duration_seconds && c.duration_seconds > 5)
  );
  const totalAnswered = answeredCalls.length;

  const interestedCalls = callList.filter((c) => c.outcome === "INTERESTED");
  const totalInterested = interestedCalls.length;

  // 4. Fetch Callbacks for this campaign
  const { count: callbacksCount } = await supabase
    .from("callbacks")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  const totalCallbacks = callbacksCount || 0;

  const connectionRate = totalDialed > 0 ? Math.round((totalAnswered / totalDialed) * 100) : 0;
  const qualificationRate = totalAnswered > 0 ? Math.round((totalInterested / totalAnswered) * 100) : 0;

  // 5. Outcome Distribution
  const outcomeCounts: Record<string, number> = {};
  for (const c of callList) {
    const out = c.outcome || (c.status === "BUSY" ? "BUSY" : c.status === "NO_ANSWER" ? "NO_ANSWER" : "OTHER");
    outcomeCounts[out] = (outcomeCounts[out] || 0) + 1;
  }

  const outcomes: OutcomeDistribution[] = Object.entries(outcomeCounts).map(([outcome, count]) => ({
    outcome,
    count,
    percentage: totalDialed > 0 ? Math.round((count / totalDialed) * 100) : 0,
  }));

  // 6. Fetch AI Analyses for voice intelligence
  const callIds = callList.map((c) => c.id);
  let topObjections: Array<{ objection: string; count: number }> = [];
  let topQuestions: Array<{ question: string; count: number }> = [];

  if (callIds.length > 0) {
    const { data: analyses } = await supabase
      .from("call_analysis")
      .select("objections, questions_asked")
      .in("call_id", callIds.slice(0, 100)); // Sample up to 100 analyses

    const objectionFreq: Record<string, number> = {};
    const questionFreq: Record<string, number> = {};

    for (const a of analyses || []) {
      if (Array.isArray(a.objections)) {
        for (const obj of a.objections) {
          if (obj && typeof obj === "string") {
            const clean = obj.trim();
            objectionFreq[clean] = (objectionFreq[clean] || 0) + 1;
          }
        }
      }
      if (Array.isArray(a.questions_asked)) {
        for (const q of a.questions_asked) {
          if (q && typeof q === "string") {
            const clean = q.trim();
            questionFreq[clean] = (questionFreq[clean] || 0) + 1;
          }
        }
      }
    }

    topObjections = Object.entries(objectionFreq)
      .map(([objection, count]) => ({ objection, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    topQuestions = Object.entries(questionFreq)
      .map(([question, count]) => ({ question, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  const totalDurationSecs = callList.reduce((acc, c) => acc + (c.duration_seconds || 0), 0);
  const avgDuration = totalDialed > 0 ? Math.round(totalDurationSecs / totalDialed) : 0;

  return {
    campaignId,
    campaignName: campaign.name,
    funnel: {
      totalEnrolled: enrolledCount || 0,
      totalDialed,
      totalAnswered,
      totalInterested,
      totalCallbacks,
      connectionRatePercent: connectionRate,
      qualificationRatePercent: qualificationRate,
    },
    outcomes,
    insights: {
      topObjections,
      topQuestions,
      averageDurationSeconds: avgDuration,
      totalDurationMinutes: Math.round(totalDurationSecs / 60),
    },
  };
}
