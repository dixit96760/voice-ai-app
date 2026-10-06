"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/auth/session";
import { getAuthContext } from "@/lib/auth/permissions";
import { hasPermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { razorpayClient } from "@/lib/providers/razorpay/client";
import { verifySubscriptionCheckoutSignature } from "@/lib/providers/razorpay/signatures";
import { quotaService } from "@/lib/billing/quota-service";
import { env } from "@/lib/env";
import { revalidatePath } from "next/cache";
import type { PlanSummary } from "@/app/(dashboard)/billing/billing-client";

export interface CheckoutSessionResult {
  success: boolean;
  error?: string;
  razorpaySubscriptionId?: string;
  razorpayKeyId?: string;
  amountPaise?: number;
  planName?: string;
}

interface PlanVersionDetails {
  id: string;
  plan_id: string;
  version: number;
  price_paise: number;
  billing_period: string;
  billing_interval: number;
  voice_minutes_limit: number;
  outbound_calls_limit: number;
  contacts_limit: number;
  max_active_campaigns: number;
  features: Record<string, boolean>;
  razorpay_plan_id: string | null;
  plans: {
    id: string;
    name: string;
    slug: string;
  };
}

/**
 * Creates a Razorpay Subscription Checkout session for a chosen Plan Version
 */
export async function createSubscriptionCheckoutAction(
  planVersionId: string
): Promise<CheckoutSessionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  const business = await getCurrentBusiness();

  if (!business) {
    return { success: false, error: "Business profile not found." };
  }

  const context = await getAuthContext();
  if (!context || !hasPermission(context.role, "billing:manage")) {
    return { success: false, error: "Insufficient permissions." };
  }

  // Fetch plan version details
  const adminSupabase = createAdminClient();
  const { data: planVersion } = await adminSupabase
    .from("plan_versions")
    .select(`
      *,
      plans (id, name, slug)
    `)
    .eq("id", planVersionId)
    .single();

  if (!planVersion) {
    return { success: false, error: "Selected plan version not found." };
  }

  const pv = planVersion as unknown as PlanVersionDetails;
  const plan = pv.plans;
  let razorpayPlanId = pv.razorpay_plan_id;

  // If Razorpay plan ID is not yet linked, create plan dynamically in Razorpay
  if (!razorpayPlanId) {
    try {
      const rpPlan = await razorpayClient.createPlan({
        period: (pv.billing_period || "monthly") as "daily" | "weekly" | "monthly" | "yearly",
        interval: pv.billing_interval || 1,
        item: {
          name: `${plan.name} Plan (v${pv.version})`,
          amount: Number(pv.price_paise),
          currency: "INR",
          description: `Subscription to ${plan.name}`,
        },
        notes: {
          plan_id: plan.id,
          plan_version_id: planVersionId,
        },
      });

      razorpayPlanId = rpPlan.id;

      // Persist generated razorpay_plan_id on plan_version
      await adminSupabase
        .from("plan_versions")
        .update({ razorpay_plan_id: razorpayPlanId })
        .eq("id", planVersionId);
    } catch (err: unknown) {
      return {
        success: false,
        error: `Failed to initialize plan on payment gateway: ${(err as Error).message}`,
      };
    }
  }

  // Create Razorpay Subscription
  try {
    const totalCount = pv.billing_period === "yearly" ? 5 : 60; // 5 years or 60 months
    const rpSub = await razorpayClient.createSubscription({
      plan_id: razorpayPlanId,
      total_count: totalCount,
      customer_notify: 1,
      notes: {
        business_id: business.id,
        plan_id: plan.id,
        plan_version_id: planVersionId,
      },
    });

    return {
      success: true,
      razorpaySubscriptionId: rpSub.id,
      razorpayKeyId: env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "",
      amountPaise: Number(pv.price_paise),
      planName: plan.name,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: `Failed to create subscription on Razorpay: ${(err as Error).message}`,
    };
  }
}

export interface VerifyPaymentResult {
  success: boolean;
  error?: string;
  pendingVerification?: boolean;
  message?: string;
}

/**
 * Verifies Razorpay Checkout signature and records payment evidence.
 * CRITICAL: Does NOT independently grant authoritative subscription entitlement (ACTIVE).
 * Authoritative lifecycle transitions and quota grants are strictly reserved for Razorpay Webhooks.
 */
export async function verifySubscriptionPaymentAction(
  paymentId: string,
  subscriptionId: string,
  signature: string,
  planVersionId: string
): Promise<VerifyPaymentResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  const business = await getCurrentBusiness();

  if (!business) {
    return { success: false, error: "Business profile not found." };
  }

  const context = await getAuthContext();
  if (!context || !hasPermission(context.role, "billing:manage")) {
    return { success: false, error: "Insufficient permissions." };
  }

  // Cryptographic Signature Verification
  const keySecret = env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || "mock_secret";
  const isValidSignature = verifySubscriptionCheckoutSignature(
    paymentId,
    subscriptionId,
    signature,
    keySecret
  );

  // Allow mock passes under mock test mode
  const isMock =
    process.env.NODE_ENV === "test" ||
    (process.env.NODE_ENV !== "production" &&
      (env.RAZORPAY_MOCK_MODE === "true" ||
        process.env.RAZORPAY_MOCK_MODE === "true"));

  if (!isValidSignature && !isMock) {
    return { success: false, error: "Invalid payment signature. Verification failed." };
  }

  const adminSupabase = createAdminClient();

  // Fetch plan version to verify price
  const { data: planVersion } = await adminSupabase
    .from("plan_versions")
    .select("*, plans (*)")
    .eq("id", planVersionId)
    .single();

  if (!planVersion) {
    return { success: false, error: "Plan version not found." };
  }

  const pv = planVersion as unknown as PlanVersionDetails;
  const now = new Date();
  const recordedAt = now.toISOString();

  // 1. Locate existing subscription record
  const { data: existingSub } = await adminSupabase
    .from("subscriptions")
    .select("id, status, limits")
    .eq("business_id", business.id)
    .maybeSingle();

  const currentStatus = existingSub?.status || "TRIAL";

  // Upsert subscription metadata, linking plan and provider subscription ID,
  // but PRESERVING current status (e.g. TRIAL) and existing limits.
  // Authoritative status change to ACTIVE is strictly reserved for Razorpay Webhooks.
  await adminSupabase.from("subscriptions").upsert(
    {
      business_id: business.id,
      plan_id: pv.plan_id,
      plan_version_id: planVersionId,
      status: currentStatus, // PRESERVE status; do NOT set ACTIVE!
      provider_status: "authenticated",
      razorpay_subscription_id: subscriptionId,
      cancel_at_period_end: false,
      updated_at: recordedAt,
    },
    { onConflict: "business_id" }
  );

  // 2. Audit checkout verification evidence in subscription_history
  if (existingSub) {
    await adminSupabase.from("subscription_history").insert({
      subscription_id: existingSub.id,
      business_id: business.id,
      from_status: currentStatus,
      to_status: currentStatus,
      reason: "Checkout Signature Authenticated (Awaiting Authoritative Webhook)",
      actor_id: user.id,
      metadata: { payment_id: paymentId, subscription_id: subscriptionId, plan_version_id: planVersionId },
    });
  }

  // 3. Persist payment evidence in payment_records (status: "authorized")
  // Webhook will subsequently transition it to "captured" and generate the tax invoice.
  // Using onConflict on razorpay_payment_id prevents any duplicate records.
  const amountPaise = Number(pv.price_paise);
  await adminSupabase
    .from("payment_records")
    .upsert(
      {
        business_id: business.id,
        subscription_id: existingSub?.id || null,
        razorpay_payment_id: paymentId,
        amount_paise: amountPaise,
        currency: "INR",
        status: "authorized",
        method: "checkout",
        metadata: {
          signature_verified: true,
          plan_version_id: planVersionId,
          checkout_timestamp: recordedAt,
        },
      },
      { onConflict: "razorpay_payment_id" }
    );

  revalidatePath("/billing");
  return {
    success: true,
    pendingVerification: true,
    message: "Payment authorized. Awaiting authoritative activation from payment gateway.",
  };
}

/**
 * Cancels a subscription either scheduled at period end or immediately
 */
export async function cancelSubscriptionAction(
  cancelAtPeriodEnd: boolean = true
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  const business = await getCurrentBusiness();

  if (!business) {
    return { success: false, error: "Business profile not found." };
  }

  const context = await getAuthContext();
  if (!context || !hasPermission(context.role, "billing:manage")) {
    return { success: false, error: "Insufficient permissions." };
  }

  const adminSupabase = createAdminClient();
  const { data: sub } = await adminSupabase
    .from("subscriptions")
    .select("*")
    .eq("business_id", business.id)
    .single();

  if (!sub) {
    return { success: false, error: "No active subscription found." };
  }

  // Cancel on Razorpay provider if linked
  if (sub.razorpay_subscription_id) {
    try {
      await razorpayClient.cancelSubscription(
        sub.razorpay_subscription_id,
        cancelAtPeriodEnd
      );
    } catch {
      // Continue with DB update if provider call was already cancelled
    }
  }

  const now = new Date().toISOString();
  const nextStatus = cancelAtPeriodEnd ? sub.status : "CANCELLED";

  await adminSupabase
    .from("subscriptions")
    .update({
      status: nextStatus,
      cancel_at_period_end: cancelAtPeriodEnd,
      cancel_requested_at: now,
      cancelled_at: cancelAtPeriodEnd ? null : now,
      cancellation_reason: "Requested by business owner",
      updated_at: now,
    })
    .eq("id", sub.id);

  await adminSupabase.from("subscription_history").insert({
    subscription_id: sub.id,
    business_id: business.id,
    from_status: sub.status,
    to_status: nextStatus,
    reason: cancelAtPeriodEnd ? "Scheduled cancellation at cycle end" : "Immediate cancellation",
    actor_id: user.id,
  });

  revalidatePath("/billing");
  return { success: true };
}

/**
 * Fetches all billing data for display on /billing
 */
export async function fetchBillingDataAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const business = await getCurrentBusiness();

  if (!business) {
    return null;
  }

  const context = await getAuthContext();
  if (!context || !hasPermission(context.role, "billing:read")) {
    return null;
  }

  const adminSupabase = createAdminClient();

  // 1. Quota & Subscription Status
  const quotaStatus = await quotaService.getBusinessQuotaStatus(business.id);

  // 2. Active Plans and their Latest Plan Versions
  const { data: plansData } = await adminSupabase
    .from("plans")
    .select("id, name, slug, description, is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const { data: versionsData } = await adminSupabase
    .from("plan_versions")
    .select("*")
    .order("version", { ascending: false });

  const plans: PlanSummary[] = (plansData || []).map((p) => {
    const versions = (versionsData || [])
      .filter((v) => v.plan_id === p.id)
      .map((v) => ({
        id: v.id,
        version: v.version,
        price_paise: v.price_paise,
        billing_period: v.billing_period,
        billing_interval: v.billing_interval,
        voice_minutes_limit: v.voice_minutes_limit,
        outbound_calls_limit: v.outbound_calls_limit,
        contacts_limit: v.contacts_limit,
        max_active_campaigns: v.max_active_campaigns,
        features: (v.features as Record<string, boolean>) || {},
        razorpay_plan_id: v.razorpay_plan_id,
      }));
    return {
      ...p,
      plan_versions: versions,
    };
  });

  // 3. Payment Records
  const { data: payments } = await adminSupabase
    .from("payment_records")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(20);

  // 4. Invoices
  const { data: invoices } = await adminSupabase
    .from("invoices")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return {
    business,
    quotaStatus,
    plans: plans || [],
    payments: payments || [],
    invoices: invoices || [],
  };
}
