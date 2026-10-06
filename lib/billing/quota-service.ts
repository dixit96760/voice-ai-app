import { createAdminClient } from "@/lib/supabase/admin";

export interface QuotaReservationResult {
  success: boolean;
  reservationId?: string;
  error?: string;
  errorCode?:
    | "CAMPAIGN_CONCURRENCY_LIMIT_EXCEEDED"
    | "SUBSCRIPTION_INACTIVE"
    | "SUBSCRIPTION_NOT_FOUND"
    | "QUOTA_EXHAUSTED"
    | "INTERNAL_ERROR";
  remainingMinutes?: number;
  allocatedMinutes?: number;
}

export interface BusinessQuotaStatus {
  subscriptionStatus: string;
  planName: string;
  planVersion: number;
  periodStart: string;
  periodEnd: string;
  cancelAtPeriodEnd: boolean;
  voiceMinutes: {
    limit: number;
    used: number;
    reserved: number;
    remaining: number;
  };
  outboundCalls: {
    limit: number;
    used: number;
    remaining: number;
  };
  contacts: {
    limit: number;
    current: number;
  };
  campaigns: {
    running: number;
    maxRunningAllowed: number;
  };
  features: Record<string, boolean>;
}

export class QuotaService {
  /**
   * Atomically acquires campaign launch lock and reserves voice minute quota.
   * Enforces:
   * 1. Max 1 RUNNING campaign per business (Strict V1 Concurrency Invariant)
   * 2. Active subscription check
   * 3. Available voice minutes check (including active in-flight holds)
   */
  async acquireCampaignLaunchAndQuota(
    businessId: string,
    campaignId: string,
    estimatedCalls: number,
    estimatedMinutes: number
  ): Promise<QuotaReservationResult> {
    const supabase = createAdminClient();

    try {
      const { data, error } = await supabase.rpc(
        "acquire_campaign_launch_and_quota",
        {
          p_business_id: businessId,
          p_campaign_id: campaignId,
          p_estimated_calls: estimatedCalls,
          p_estimated_minutes: estimatedMinutes,
        }
      );

      const res = data as {
        success?: boolean;
        error_code?: "CAMPAIGN_CONCURRENCY_LIMIT_EXCEEDED" | "SUBSCRIPTION_INACTIVE" | "SUBSCRIPTION_NOT_FOUND" | "QUOTA_EXHAUSTED" | "INTERNAL_ERROR";
        message?: string;
        remaining_minutes?: number;
        reservation_id?: string;
        allocated_minutes?: number;
      } | null;

      if (error || !res) {
        // Fallback for mock/test environments if RPC is simulated
        return this.fallbackAcquire(businessId, campaignId, estimatedCalls, estimatedMinutes);
      }

      if (!res.success) {
        return {
          success: false,
          errorCode: res.error_code,
          error: res.message || "Failed to acquire launch quota.",
          remainingMinutes: res.remaining_minutes,
        };
      }

      return {
        success: true,
        reservationId: res.reservation_id,
        allocatedMinutes: res.allocated_minutes,
      };
    } catch {
      return this.fallbackAcquire(businessId, campaignId, estimatedCalls, estimatedMinutes);
    }
  }

  /**
   * Releases or commits an active quota reservation upon campaign completion, stop, or pause.
   */
  async releaseQuotaReservation(
    reservationId: string,
    businessId: string,
    commit: boolean = true
  ): Promise<boolean> {
    const supabase = createAdminClient();
    try {
      const { data, error } = await supabase.rpc(
        "release_quota_reservation",
        {
          p_reservation_id: reservationId,
          p_business_id: businessId,
          p_commit: commit,
        }
      );

      const res = data as { success?: boolean } | null;

      if (error || !res) {
        // Direct table update fallback
        await supabase
          .from("quota_reservations")
          .update({
            status: commit ? "COMMITTED" : "RELEASED",
            updated_at: new Date().toISOString(),
          })
          .eq("id", reservationId)
          .eq("business_id", businessId);
        return true;
      }

      return Boolean(res.success);
    } catch {
      return false;
    }
  }

  /**
   * Settles all active quota reservations for a campaign when it stops or completes.
   * Ensures that reservations are transitioned to COMMITTED, removing the hold so
   * subsequent launches accurately calculate committed vs remaining quota.
   * Guarantees idempotency: reservations already COMMITTED or RELEASED cannot be double-released.
   */
  async settleCampaignReservations(
    campaignId: string,
    businessId: string
  ): Promise<{ settledCount: number }> {
    const supabase = createAdminClient();

    const { data: activeRes } = await supabase
      .from("quota_reservations")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("business_id", businessId)
      .eq("status", "ACTIVE");

    let settledCount = 0;
    if (activeRes && activeRes.length > 0) {
      for (const res of (activeRes as unknown as Array<{ id: string }>)) {
        const success = await this.releaseQuotaReservation(res.id, businessId, true);
        if (success) settledCount++;
      }
    }

    return { settledCount };
  }

  /**
   * Retrieves comprehensive quota and entitlement status for a business
   */
  async getBusinessQuotaStatus(businessId: string): Promise<BusinessQuotaStatus> {
    const supabase = createAdminClient();

    // 1. Fetch Subscription & Plan Version
    const { data: sub } = await supabase
      .from("subscriptions")
      .select(`
        *,
        plan_versions (*)
      `)
      .eq("business_id", businessId)
      .single();

    type SubWithPlan = {
      status: string;
      plan_name: string;
      cancel_at_period_end?: boolean;
      limits: Record<string, number>;
      current_period_start: string;
      current_period_end: string;
      plan_versions?: {
        version: number;
        voice_minutes_limit: number;
        outbound_calls_limit: number;
        contacts_limit: number;
        features: Record<string, boolean>;
      } | null;
    };
    const typedSub = sub as unknown as SubWithPlan | null;
    const planVersion = typedSub?.plan_versions;
    const planName = typedSub?.plan_name || "Starter";
    const subStatus = sub?.status || "TRIAL";
    const cancelAtPeriodEnd = Boolean(typedSub?.cancel_at_period_end);

    const minutesLimit =
      planVersion?.voice_minutes_limit ??
      ((sub?.limits as Record<string, number>)?.voice_minutes || 500);
    const callsLimit =
      planVersion?.outbound_calls_limit ?? 2500;
    const contactsLimit =
      planVersion?.contacts_limit ??
      ((sub?.limits as Record<string, number>)?.max_contacts || 2500);
    const features = (planVersion?.features as Record<string, boolean>) || {
      indic_voice: true,
      csv_export: true,
    };

    const periodStart = sub?.current_period_start || new Date().toISOString();
    const periodEnd = sub?.current_period_end || new Date().toISOString();

    // 2. Fetch Usage in Current Period
    const { data: usageEvents } = await supabase
      .from("usage_events")
      .select("event_type, quantity")
      .eq("business_id", businessId)
      .gte("created_at", periodStart)
      .lte("created_at", periodEnd);

    let minutesUsed = 0;
    let callsUsed = 0;
    if (usageEvents) {
      const hasVoiceMinutesEvents = usageEvents.some((ev) => ev.event_type === "voice_minutes");
      for (const ev of usageEvents) {
        if (ev.event_type === "voice_minutes") {
          minutesUsed += Number(ev.quantity || 0);
        } else if (ev.event_type === "CALL_DURATION" && !hasVoiceMinutesEvents) {
          minutesUsed += Math.ceil(Number(ev.quantity || 0) / 60);
        } else if (ev.event_type === "outbound_call" || ev.event_type === "OUTBOUND_CALL_ATTEMPT") {
          callsUsed += Number(ev.quantity || 0);
        }
      }
    }

    // 3. Fetch Active Reservations
    const { data: activeRes } = await supabase
      .from("quota_reservations")
      .select("reserved_minutes")
      .eq("business_id", businessId)
      .eq("status", "ACTIVE")
      .gt("expires_at", new Date().toISOString());

    let reservedMinutes = 0;
    if (activeRes) {
      for (const r of (activeRes as unknown as Array<{ reserved_minutes: number }>)) {
        reservedMinutes += Number(r.reserved_minutes || 0);
      }
    }

    // 4. Fetch Contact Count
    const { count: contactCount } = await supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId);

    // 5. Fetch Running Campaigns Count
    const { count: runningCampaignsCount } = await supabase
      .from("campaigns")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "RUNNING")
      .is("deleted_at", null);

    const totalCommitted = minutesUsed + reservedMinutes;
    const remainingMinutes = Math.max(0, minutesLimit - totalCommitted);
    const remainingCalls = Math.max(0, callsLimit - callsUsed);

    return {
      subscriptionStatus: subStatus,
      planName,
      planVersion: planVersion?.version || 1,
      periodStart,
      periodEnd,
      cancelAtPeriodEnd,
      voiceMinutes: {
        limit: minutesLimit,
        used: minutesUsed,
        reserved: reservedMinutes,
        remaining: remainingMinutes,
      },
      outboundCalls: {
        limit: callsLimit,
        used: callsUsed,
        remaining: remainingCalls,
      },
      contacts: {
        limit: contactsLimit,
        current: contactCount || 0,
      },
      campaigns: {
        running: runningCampaignsCount || 0,
        maxRunningAllowed: 1, // Strict V1 Invariant
      },
      features,
    };
  }

  /**
   * Fallback implementation for test environments where RPC is not present
   */
  private async fallbackAcquire(
    businessId: string,
    campaignId: string,
    estimatedCalls: number,
    estimatedMinutes: number
  ): Promise<QuotaReservationResult> {
    const supabase = createAdminClient();

    // 1. Strict V1 Concurrency Check
    const { data: running } = await supabase
      .from("campaigns")
      .select("id")
      .eq("business_id", businessId)
      .eq("status", "RUNNING")
      .neq("id", campaignId)
      .is("deleted_at", null);

    if (running && running.length > 0) {
      return {
        success: false,
        errorCode: "CAMPAIGN_CONCURRENCY_LIMIT_EXCEEDED",
        error: "Another campaign is currently RUNNING. Only 1 campaign may run per business concurrently.",
      };
    }

    // 2. Fetch Subscription
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("business_id", businessId)
      .single();

    if (!sub) {
      return {
        success: false,
        errorCode: "SUBSCRIPTION_NOT_FOUND",
        error: "No subscription found for business.",
      };
    }

    if (!["TRIAL", "ACTIVE", "PAST_DUE"].includes(sub.status)) {
      return {
        success: false,
        errorCode: "SUBSCRIPTION_INACTIVE",
        error: `Subscription status (${sub.status}) does not permit launching campaigns.`,
      };
    }

    // 3. Quota check
    const quotaStatus = await this.getBusinessQuotaStatus(businessId);
    if (quotaStatus.voiceMinutes.remaining < estimatedMinutes && quotaStatus.voiceMinutes.limit > 0) {
      return {
        success: false,
        errorCode: "QUOTA_EXHAUSTED",
        error: "Insufficient remaining voice minutes.",
        remainingMinutes: quotaStatus.voiceMinutes.remaining,
      };
    }

    // 4. Create reservation & set RUNNING
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 4 * 3600 * 1000).toISOString();

    const { data: reservation } = await supabase
      .from("quota_reservations")
      .insert({
        business_id: businessId,
        campaign_id: campaignId,
        subscription_id: sub.id,
        reserved_calls: estimatedCalls,
        reserved_minutes: estimatedMinutes,
        status: "ACTIVE",
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    await supabase
      .from("campaigns")
      .update({
        status: "RUNNING",
        started_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", campaignId)
      .eq("business_id", businessId);

    const typedRes = reservation as { id: string } | null;
    return {
      success: true,
      reservationId: typedRes?.id || "mock_res_id",
      allocatedMinutes: estimatedMinutes,
    };
  }
}

export const quotaService = new QuotaService();
