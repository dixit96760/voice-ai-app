import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRazorpayWebhookSignature } from "@/lib/providers/razorpay/signatures";
import { taxEngine } from "@/lib/billing/tax-service";
import { sha256Hex } from "@/lib/security/webhook-signature";
import type { RazorpayWebhookPayload } from "@/lib/providers/razorpay/types";
import type { Json } from "@/lib/supabase/types";

export interface WebhookProcessResult {
  statusCode: number;
  message: string;
  processed: boolean;
  ignored?: boolean;
  reason?: string;
  eventId?: string;
}

// In-memory fast-path deduplication cache & fallback for test environments
const processedEventIdsCache = new Set<string>();

export class RazorpayWebhookService {
  /**
   * Securely processes an incoming server-to-server Razorpay webhook
   */
  async processWebhook(
    rawBody: string | Buffer,
    signatureHeader: string | null,
    webhookSecret: string,
    eventIdHeader?: string | null
  ): Promise<WebhookProcessResult> {
    // 1. Signature Verification
    if (!signatureHeader || !verifyRazorpayWebhookSignature(rawBody, signatureHeader, webhookSecret)) {
      return {
        statusCode: 400,
        message: "Invalid or missing Razorpay webhook signature.",
        processed: false,
      };
    }

    // 2. Parse Payload
    let payload: RazorpayWebhookPayload;
    try {
      const rawString = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
      payload = JSON.parse(rawString);
    } catch {
      return {
        statusCode: 400,
        message: "Malformed JSON payload in webhook body.",
        processed: false,
      };
    }

    const eventName = payload.event;
    const providerEventId =
      eventIdHeader ||
      (payload as unknown as { id?: string }).id ||
      `evt_${Date.now()}_${Math.random()}`;
    const eventCreatedAt = payload.created_at
      ? new Date(payload.created_at * 1000).toISOString()
      : new Date().toISOString();

    const supabase = createAdminClient();

    // 3. Idempotency Check & Logging via webhook_events (with fast-path cache)
    if (processedEventIdsCache.has(providerEventId)) {
      return {
        statusCode: 200,
        message: "Event already processed or in-flight (Idempotent).",
        processed: true,
        ignored: true,
        reason: "DUPLICATE_EVENT",
        eventId: providerEventId,
      };
    }

    const { data: existingEvent } = await supabase
      .from("webhook_events")
      .select("id, status")
      .eq("provider", "razorpay")
      .eq("provider_event_id", providerEventId)
      .maybeSingle();

    if (existingEvent) {
      processedEventIdsCache.add(providerEventId);
      return {
        statusCode: 200,
        message: "Event already processed or in-flight (Idempotent).",
        processed: true,
        ignored: true,
        reason: "DUPLICATE_EVENT",
        eventId: providerEventId,
      };
    }

    processedEventIdsCache.add(providerEventId);

    // Insert into webhook_events with PROCESSING status
    const { data: insertedEvent } = await supabase
      .from("webhook_events")
      .insert({
        provider: "razorpay",
        provider_event_id: providerEventId,
        event_type: eventName,
        payload: payload as unknown as Json,
        status: "PROCESSING",
        payload_hash: sha256Hex(rawBody),
        signature_valid: true,
        signature_provider: "razorpay",
        provider_event_created_at: eventCreatedAt,
        received_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    const webhookEventDbId = insertedEvent?.id;

    // 4. Dispatch Event to Appropriate Transition Handler
    try {
      let result: { processed: boolean; ignored?: boolean; reason?: string } = { processed: true };

      if (eventName.startsWith("subscription.")) {
        result = await this.handleSubscriptionEvent(payload, webhookEventDbId, eventCreatedAt);
        // If subscription.charged includes payment entity, record payment and invoice
        if (eventName === "subscription.charged" && payload.payload.payment?.entity) {
          await this.handlePaymentEvent(payload);
        }
      } else if (eventName.startsWith("payment.")) {
        result = await this.handlePaymentEvent(payload);
      } else if (eventName.startsWith("refund.")) {
        result = await this.handleRefundEvent(payload);
      }

      // Mark event as PROCESSED in webhook_events
      if (webhookEventDbId) {
        await supabase
          .from("webhook_events")
          .update({
            status: "PROCESSED",
            processed: true,
            processed_at: new Date().toISOString(),
          })
          .eq("id", webhookEventDbId);
      }

      return {
        statusCode: 200,
        message: `Event ${eventName} handled successfully.`,
        processed: result.processed,
        ignored: result.ignored,
        reason: result.reason,
        eventId: providerEventId,
      };
    } catch (err: unknown) {
      if (webhookEventDbId) {
        await supabase
          .from("webhook_events")
          .update({
            status: "FAILED",
            processed_at: new Date().toISOString(),
          })
          .eq("id", webhookEventDbId);
      }
      return {
        statusCode: 500,
        message: `Failed to process event ${eventName}: ${(err as Error).message}`,
        processed: false,
      };
    }
  }

  /**
   * Subscription Event Handler with Out-of-Order Transition Guards
   */
  private async handleSubscriptionEvent(
    payload: RazorpayWebhookPayload,
    eventDbId?: string,
    eventCreatedAt?: string
  ): Promise<{ processed: boolean; ignored?: boolean; reason?: string }> {
    const subEntity = payload.payload.subscription?.entity;
    if (!subEntity) {
      return { processed: false, ignored: true, reason: "MISSING_SUBSCRIPTION_ENTITY" };
    }

    const razorpaySubId = subEntity.id;
    const supabase = createAdminClient();

    // 1. Locate Internal Subscription Record
    let { data: currentSub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("razorpay_subscription_id", razorpaySubId)
      .maybeSingle();

    // Fallback search by notes.business_id
    if (!currentSub && subEntity.notes?.business_id) {
      const { data: byBiz } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("business_id", subEntity.notes.business_id)
        .maybeSingle();
      currentSub = byBiz;
    }

    if (!currentSub) {
      return { processed: false, ignored: true, reason: "SUBSCRIPTION_RECORD_NOT_FOUND" };
    }

    const currentStatus = currentSub.status;
    const currentPeriodEnd = currentSub.current_period_end;
    const eventTime = eventCreatedAt || new Date().toISOString();

    // 2. STATE TRANSITION GUARDS

    // Guard A: Terminal State Guard (Immediate cancellation or permanent expiration)
    if (
      (currentStatus === "CANCELLED" || currentStatus === "EXPIRED") &&
      !currentSub.cancel_at_period_end
    ) {
      if (currentSub.cancelled_at && eventTime < currentSub.cancelled_at) {
        return {
          processed: true,
          ignored: true,
          reason: "OUT_OF_ORDER_IGNORED_TERMINAL_STATE",
        };
      }
    }

    // Guard B: Active Recovery Guard for delayed `subscription.pending`
    if (payload.event === "subscription.pending") {
      if (currentStatus === "ACTIVE" && currentSub.last_event_at && eventTime < currentSub.last_event_at) {
        return {
          processed: true,
          ignored: true,
          reason: "OUT_OF_ORDER_STALE_PENDING_IGNORED",
        };
      }
    }

    // Guard C: Monotonic Period Guard for `subscription.charged`
    if (payload.event === "subscription.charged" && subEntity.current_end) {
      const payloadCycleEnd = new Date(subEntity.current_end * 1000).toISOString();
      if (currentPeriodEnd && payloadCycleEnd < currentPeriodEnd) {
        return {
          processed: true,
          ignored: true,
          reason: "OUT_OF_ORDER_PAST_CYCLE_IGNORED",
        };
      }
    }

    // 3. Process Specific Event
    let nextStatus = currentStatus;
    let cancelAtPeriodEnd = currentSub.cancel_at_period_end;
    let cancelRequestedAt = currentSub.cancel_requested_at;
    let cancelledAt = currentSub.cancelled_at;
    let gracePeriodEndsAt = currentSub.grace_period_ends_at;
    let dunningRetries = currentSub.dunning_retries_count;
    let periodStart = currentSub.current_period_start;
    let periodEnd = currentSub.current_period_end;

    switch (payload.event) {
      case "subscription.authenticated":
        // Mandate created. If in TRIAL, keep TRIAL until first billing cycle
        if (currentStatus !== "TRIAL") {
          nextStatus = "ACTIVE";
        }
        break;

      case "subscription.activated":
        nextStatus = "ACTIVE";
        dunningRetries = 0;
        gracePeriodEndsAt = null;
        if (subEntity.current_start) {
          periodStart = new Date(subEntity.current_start * 1000).toISOString();
        }
        if (subEntity.current_end) {
          periodEnd = new Date(subEntity.current_end * 1000).toISOString();
        }
        break;

      case "subscription.charged":
        nextStatus = "ACTIVE";
        dunningRetries = 0;
        gracePeriodEndsAt = null;
        if (subEntity.current_start) {
          periodStart = new Date(subEntity.current_start * 1000).toISOString();
        }
        if (subEntity.current_end) {
          periodEnd = new Date(subEntity.current_end * 1000).toISOString();
        }
        break;

      case "subscription.pending":
        // Failed auto-debit; enter 3-day grace period
        nextStatus = "PAST_DUE";
        dunningRetries = (dunningRetries || 0) + 1;
        if (!gracePeriodEndsAt) {
          const g = new Date();
          g.setDate(g.getDate() + 3);
          gracePeriodEndsAt = g.toISOString();
        }
        break;

      case "subscription.halted":
        // Retries exhausted; immediately suspend dialing privileges
        nextStatus = "SUSPENDED";
        // Gracefully pause any currently running campaign
        await this.pauseRunningCampaignOnSuspension(currentSub.business_id, "SUBSCRIPTION_SUSPENDED");
        break;

      case "subscription.cancelled":
        // Evaluate if cancellation is scheduled or immediate
        const now = new Date().toISOString();
        if (subEntity.ended_at) {
          // Immediate or already completed
          nextStatus = "CANCELLED";
          cancelledAt = now;
          cancelAtPeriodEnd = false;
        } else {
          // Scheduled at cycle end
          cancelAtPeriodEnd = true;
          cancelRequestedAt = now;
          // Remains service-active until periodEnd
          nextStatus = "ACTIVE";
        }
        break;

      case "subscription.paused":
        nextStatus = "SUSPENDED";
        await this.pauseRunningCampaignOnSuspension(currentSub.business_id, "SUBSCRIPTION_PAUSED");
        break;

      case "subscription.resumed":
        nextStatus = "ACTIVE";
        break;

      case "subscription.completed":
        // All scheduled cycles completed
        nextStatus = "EXPIRED";
        await this.pauseRunningCampaignOnSuspension(currentSub.business_id, "SUBSCRIPTION_COMPLETED");
        break;
    }

    // 4. Update Subscription & Authoritative Quota Entitlements
    let updatedLimits = currentSub.limits;
    const planVersionId = currentSub.plan_version_id || subEntity.notes?.plan_version_id;
    if (nextStatus === "ACTIVE" && planVersionId) {
      const { data: pv } = await supabase
        .from("plan_versions")
        .select("voice_minutes_limit, outbound_calls_limit, contacts_limit")
        .eq("id", planVersionId)
        .maybeSingle();

      if (pv) {
        updatedLimits = {
          voice_minutes: pv.voice_minutes_limit,
          outbound_calls: pv.outbound_calls_limit,
          max_contacts: pv.contacts_limit,
        };
      }
    }

    await supabase
      .from("subscriptions")
      .update({
        status: nextStatus,
        limits: updatedLimits,
        plan_version_id: planVersionId || currentSub.plan_version_id,
        provider_status: subEntity.status,
        razorpay_subscription_id: razorpaySubId,
        razorpay_customer_id: subEntity.customer_id || currentSub.razorpay_customer_id,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
        cancel_requested_at: cancelRequestedAt,
        cancelled_at: cancelledAt,
        dunning_retries_count: dunningRetries,
        grace_period_ends_at: gracePeriodEndsAt,
        last_event_at: eventTime,
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentSub.id);

    // 5. Record State Transition in subscription_history if changed
    if (nextStatus !== currentStatus) {
      await supabase.from("subscription_history").insert({
        subscription_id: currentSub.id,
        business_id: currentSub.business_id,
        from_status: currentStatus,
        to_status: nextStatus,
        reason: `Webhook: ${payload.event}`,
        event_id: eventDbId || null,
        metadata: { razorpay_event: payload.event, provider_status: subEntity.status },
      });
    }

    return { processed: true };
  }

  /**
   * Payment Event Handler: records payments and generates invoices
   */
  private async handlePaymentEvent(
    payload: RazorpayWebhookPayload
  ): Promise<{ processed: boolean; ignored?: boolean; reason?: string }> {
    const payment = payload.payload.payment?.entity;
    if (!payment) {
      return { processed: false, ignored: true, reason: "MISSING_PAYMENT_ENTITY" };
    }

    const supabase = createAdminClient();
    const amountPaise = payment.amount || 0;
    const razorpayPaymentId = payment.id;

    // Locate Subscription / Business
    let businessId: string | null = null;
    let subscriptionId: string | null = null;

    if (payment.notes?.business_id) {
      businessId = payment.notes.business_id;
    }

    if (!businessId && payload.payload.subscription?.entity?.notes?.business_id) {
      businessId = payload.payload.subscription.entity.notes.business_id;
    }

    if (!businessId && payload.payload.subscription?.entity?.id) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id, business_id")
        .eq("razorpay_subscription_id", payload.payload.subscription.entity.id)
        .maybeSingle();
      if (sub) {
        subscriptionId = sub.id;
        businessId = sub.business_id;
      }
    }

    if (businessId && !subscriptionId) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("business_id", businessId)
        .maybeSingle();
      if (sub) {
        subscriptionId = sub.id;
      }
    }

    if (!businessId) {
      return { processed: false, ignored: true, reason: "BUSINESS_NOT_FOUND_FOR_PAYMENT" };
    }

    // Upsert Payment Record
    const paymentRecordStatus =
      payment.status === "captured"
        ? "captured"
        : payment.status === "failed"
          ? "failed"
          : payment.status === "authorized"
            ? "authorized"
            : "created";

    const { data: paymentRecord } = await supabase
      .from("payment_records")
      .upsert(
        {
          business_id: businessId,
          subscription_id: subscriptionId,
          razorpay_payment_id: razorpayPaymentId,
          razorpay_order_id: payment.order_id || null,
          razorpay_invoice_id: payment.invoice_id || null,
          amount_paise: amountPaise,
          currency: payment.currency || "INR",
          status: paymentRecordStatus,
          method: payment.method || "unknown",
          bank: payment.bank || null,
          wallet: payment.wallet || null,
          vpa: payment.vpa || null,
          email: payment.email || null,
          contact: payment.contact || null,
          error_code: payment.error_code || null,
          error_description: payment.error_description || null,
          error_source: payment.error_source || null,
          error_step: payment.error_step || null,
          error_reason: payment.error_reason || null,
          reconciled_at: paymentRecordStatus === "captured" ? new Date().toISOString() : null,
          metadata: { provider_created_at: payment.created_at },
        },
        { onConflict: "razorpay_payment_id" }
      )
      .select("id")
      .single();

    // If Payment is Captured, create Invoice if not already present
    if (paymentRecordStatus === "captured") {
      const paymentRecId = (paymentRecord as { id: string } | null)?.id;
      const { data: existingInvoice } = paymentRecId
        ? await supabase
            .from("invoices")
            .select("id")
            .eq("payment_id", paymentRecId)
            .maybeSingle()
        : { data: null };

      if (!existingInvoice) {
        const { data: business } = await supabase
          .from("businesses")
          .select("gstin, billing_state_code, is_tax_exempt, tax_exemption_reason")
          .eq("id", businessId)
          .single();

        const taxResult = taxEngine.calculateTax({
          subtotalPaise: amountPaise,
          customerGstin: business?.gstin,
          customerBillingStateCode: business?.billing_state_code,
          isTaxExempt: business?.is_tax_exempt,
          taxExemptionReason: business?.tax_exemption_reason,
        });

        const now = new Date();
        const periodStart = now.toISOString();
        const periodEnd = new Date(now.getTime() + 30 * 86400 * 1000).toISOString();

        const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

        await supabase.from("invoices").insert({
          business_id: businessId,
          subscription_id: subscriptionId,
          payment_id: paymentRecId || null,
          invoice_number: invoiceNumber,
          razorpay_invoice_id: payment.invoice_id || null,
          subtotal_paise: taxResult.subtotalPaise,
          tax_type: taxResult.taxType,
          tax_rate_percent: taxResult.taxRatePercent,
          tax_paise: taxResult.taxPaise,
          tax_breakdown: taxResult.taxBreakdown as unknown as Json,
          total_paise: taxResult.totalPaise,
          amount_paid_paise: taxResult.totalPaise,
          period_start: periodStart,
          period_end: periodEnd,
          status: "paid",
          paid_at: now.toISOString(),
          customer_gstin: business?.gstin || null,
        });
      }
    }

    return { processed: true };
  }

  /**
   * Refund Event Handler
   */
  private async handleRefundEvent(
    payload: RazorpayWebhookPayload
  ): Promise<{ processed: boolean; ignored?: boolean; reason?: string }> {
    const refund = payload.payload.refund?.entity;
    if (!refund) {
      return { processed: false, ignored: true, reason: "MISSING_REFUND_ENTITY" };
    }

    const supabase = createAdminClient();

    // Find payment record
    const { data: paymentRecord } = await supabase
      .from("payment_records")
      .select("id, business_id")
      .eq("razorpay_payment_id", refund.payment_id)
      .maybeSingle();

    if (!paymentRecord) {
      return { processed: false, ignored: true, reason: "PAYMENT_RECORD_NOT_FOUND_FOR_REFUND" };
    }

    const rec = paymentRecord as { id: string; business_id: string };
    await supabase.from("refund_records").upsert(
      {
        payment_id: rec.id,
        business_id: rec.business_id,
        razorpay_refund_id: refund.id,
        amount_paise: refund.amount,
        currency: refund.currency || "INR",
        status: refund.status || "processed",
        speed_processed: refund.speed_processed || "normal",
        notes: refund.notes || {},
      },
      { onConflict: "razorpay_refund_id" }
    );

    return { processed: true };
  }

  /**
   * Auto-pauses any active campaign when a subscription is suspended or halted
   */
  private async pauseRunningCampaignOnSuspension(
    businessId: string,
    reason: string
  ): Promise<void> {
    const supabase = createAdminClient();

    const { data: runningCampaigns } = await supabase
      .from("campaigns")
      .select("id, name")
      .eq("business_id", businessId)
      .eq("status", "RUNNING")
      .is("deleted_at", null);

    if (runningCampaigns && runningCampaigns.length > 0) {
      for (const c of runningCampaigns) {
        await supabase
          .from("campaigns")
          .update({
            status: "PAUSED",
            updated_at: new Date().toISOString(),
          })
          .eq("id", c.id);

        await supabase.from("audit_logs").insert({
          business_id: businessId,
          action: "CAMPAIGN_AUTO_PAUSED",
          entity_type: "campaign",
          entity_id: c.id,
          new_values: {
            reason,
            note: "Campaign automatically paused due to subscription suspension.",
          },
        });
      }
    }
  }
}

export const razorpayWebhookService = new RazorpayWebhookService();
