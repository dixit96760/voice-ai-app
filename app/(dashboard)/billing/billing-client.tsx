"use client";

import { useState } from "react";
import { CheckoutDialog } from "./checkout-dialog";
import { cancelSubscriptionAction } from "@/lib/billing/actions";
import type { BusinessQuotaStatus } from "@/lib/billing/quota-service";
import {
  PhoneCall,
  Users,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";

export interface PlanVersionSummary {
  id: string;
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
}

export interface PlanSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  plan_versions: PlanVersionSummary[];
}

export interface InvoiceSummary {
  id: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  subtotal_paise: number;
  tax_type: string;
  tax_rate_percent: number;
  tax_paise: number;
  total_paise: number;
  status: string;
}

interface BillingClientProps {
  business: { id: string; business_name: string };
  quotaStatus: BusinessQuotaStatus;
  plans: PlanSummary[];
  payments: unknown[];
  invoices: InvoiceSummary[];
}

export function BillingClient({
  quotaStatus,
  plans,
  invoices,
}: BillingClientProps) {
  const [selectedInterval, setSelectedInterval] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlanVersion, setSelectedPlanVersion] = useState<{
    id: string;
    name: string;
    pricePaise: number;
    billingPeriod: string;
  } | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleCancelSubscription = async () => {
    setCancelling(true);
    setCancelError(null);
    const result = await cancelSubscriptionAction(cancelAtPeriodEnd);
    if (!result.success) {
      setCancelError(result.error || "Unable to cancel the subscription right now.");
      setCancelling(false);
      return;
    }
    setCancelling(false);
    setIsCancelModalOpen(false);
    window.location.reload();
  };

  const minutesPercent =
    quotaStatus.voiceMinutes.limit > 0
      ? Math.min(
          100,
          Math.round((quotaStatus.voiceMinutes.used / quotaStatus.voiceMinutes.limit) * 100)
        )
      : 0;

  const contactsPercent =
    quotaStatus.contacts.limit > 0
      ? Math.min(
          100,
          Math.round((quotaStatus.contacts.current / quotaStatus.contacts.limit) * 100)
        )
      : 0;

  return (
    <div className="space-y-8 pb-16">
      {/* 1. Header & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Billing & Subscriptions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your subscription plan, view live voice quotas, and review GST invoices.
          </p>
        </div>

        {quotaStatus.cancelAtPeriodEnd && (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span>Scheduled to cancel at end of billing cycle</span>
          </div>
        )}
      </div>

      {/* 2. Current Plan Overview & Quota Meters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Active Plan Card */}
        <div className="rounded-xl border bg-card p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/5 px-2 py-0.5 rounded">
                Current Subscription
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  quotaStatus.subscriptionStatus === "ACTIVE"
                    ? "bg-emerald-100 text-emerald-800"
                    : quotaStatus.subscriptionStatus === "TRIAL"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-red-100 text-red-800"
                }`}
              >
                {quotaStatus.subscriptionStatus}
              </span>
            </div>

            <h3 className="text-2xl font-bold text-foreground mt-3">
              {quotaStatus.planName} Plan
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Version {quotaStatus.planVersion} • Single-Campaign Concurrency (V1)
            </p>

            <div className="mt-4 pt-4 border-t space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Cycle Ends:</span>
                <span className="font-semibold text-foreground">
                  {new Date(quotaStatus.periodEnd).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Max Running Campaigns:</span>
                <span className="font-semibold text-foreground">
                  {quotaStatus.campaigns.maxRunningAllowed} (Concurrent)
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t flex items-center justify-between">
            {quotaStatus.subscriptionStatus === "ACTIVE" && !quotaStatus.cancelAtPeriodEnd && (
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(true)}
                className="text-xs font-medium text-red-600 hover:text-red-700 underline"
              >
                Cancel Subscription
              </button>
            )}
            <span className="text-xs text-muted-foreground/70">Asia/Kolkata (IST)</span>
          </div>
        </div>

        {/* Voice Minutes Meter */}
        <div className="rounded-xl border bg-card p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                <PhoneCall className="h-4 w-4 text-primary" />
                Voice Minutes Allowance
              </span>
              <span>{minutesPercent}% used</span>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-foreground">
                {quotaStatus.voiceMinutes.remaining}
              </span>
              <span className="text-sm text-muted-foreground">
                minutes remaining of {quotaStatus.voiceMinutes.limit}
              </span>
            </div>

            <div className="mt-4 h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  minutesPercent > 85 ? "bg-amber-500" : "bg-primary"
                }`}
                style={{ width: `${minutesPercent}%` }}
              />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t flex items-center justify-between text-xs text-muted-foreground">
            <span>Used: {quotaStatus.voiceMinutes.used} min</span>
            <span>Reserved: {quotaStatus.voiceMinutes.reserved} min</span>
          </div>
        </div>

        {/* Contacts & Concurrency Meter */}
        <div className="rounded-xl border bg-card p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                <Users className="h-4 w-4 text-primary" />
                Contact Directory Capacity
              </span>
              <span>{contactsPercent}%</span>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-foreground">
                {quotaStatus.contacts.current.toLocaleString("en-IN")}
              </span>
              <span className="text-sm text-muted-foreground">
                stored of {quotaStatus.contacts.limit.toLocaleString("en-IN")} max
              </span>
            </div>

            <div className="mt-4 h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${contactsPercent}%` }}
              />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t flex items-center justify-between text-xs text-muted-foreground">
            <span>Running Campaigns:</span>
            <span className="font-semibold text-foreground">
              {quotaStatus.campaigns.running} / {quotaStatus.campaigns.maxRunningAllowed} (Active)
            </span>
          </div>
        </div>
      </div>

      {/* 3. Plan Switcher & Pricing Matrix */}
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b">
          <div>
            <h2 className="text-lg font-bold text-foreground">Available Subscription Plans</h2>
            <p className="text-sm text-muted-foreground">
              Select a tier that matches your outbound dialing capacity. All plans operate under the V1 single-campaign concurrency rule.
            </p>
          </div>

          {/* Monthly / Yearly Switcher */}
          <div className="flex items-center bg-muted p-1 rounded-lg border">
            <button
              type="button"
              aria-pressed={selectedInterval === "monthly"}
              onClick={() => setSelectedInterval("monthly")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                selectedInterval === "monthly"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              aria-pressed={selectedInterval === "yearly"}
              onClick={() => setSelectedInterval("yearly")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition flex items-center gap-1 ${
                selectedInterval === "yearly"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Yearly</span>
              <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded font-bold">
                Save 15%
              </span>
            </button>
          </div>
        </div>

        {/* Plan Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
          {plans.map((p) => {
            const version =
              p.plan_versions?.find(
                (candidate) =>
                  candidate.billing_interval ===
                  (selectedInterval === "monthly" ? 1 : 12)
              ) || p.plan_versions?.[0];
            if (!version) return null;

            const isCurrent = quotaStatus.planName.toLowerCase() === p.slug.toLowerCase();
            const pricePaise = Number(version.price_paise);
            const displayPrice = `₹${(pricePaise / 100).toLocaleString("en-IN")}`;
            const features = (version.features as Record<string, boolean>) || {};

            return (
              <div
                key={p.id}
                className={`rounded-xl border p-6 flex flex-col justify-between transition-all ${
                  isCurrent
                    ? "border-primary ring-2 ring-primary/10 bg-primary/5/20"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-foreground">{p.name}</h3>
                    {isCurrent && (
                      <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        Active Plan
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground mt-1">{p.description}</p>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-foreground">
                      {displayPrice}
                    </span>
                    <span className="text-xs text-muted-foreground">/ {version.billing_period}</span>
                  </div>

                  <ul className="mt-6 space-y-2.5 text-xs text-muted-foreground border-t pt-4">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>{version.voice_minutes_limit.toLocaleString("en-IN")} Voice Minutes</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>{version.contacts_limit.toLocaleString("en-IN")} Contacts Directory</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Max 1 Concurrent RUNNING Campaign</span>
                    </li>
                    {features.indic_voice && (
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>Bilingual Indic & English Voice Personas</span>
                      </li>
                    )}
                    {features.custom_knowledge && (
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>Custom Knowledge & Objection Handlers</span>
                      </li>
                    )}
                    {features.priority_support && (
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>Dedicated Priority Support</span>
                      </li>
                    )}
                  </ul>
                </div>

                <div className="mt-6 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedPlanVersion({
                        id: version.id,
                        name: p.name,
                        pricePaise,
                        billingPeriod: version.billing_period,
                      })
                    }
                    disabled={isCurrent}
                    className={`w-full py-2.5 px-4 text-xs font-semibold rounded-lg transition ${
                      isCurrent
                        ? "bg-muted text-muted-foreground/70 cursor-default"
                        : "bg-primary text-white hover:bg-primary/90 shadow-sm"
                    }`}
                  >
                    {isCurrent ? "Current Active Plan" : "Upgrade Plan"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Payment & Invoice History */}
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-foreground">Invoices & Payment Records</h3>
        <p className="text-xs text-muted-foreground">
          All invoices include detailed Indian GST breakdowns (CGST + SGST or IGST) based on your registered business profile.
        </p>

        {invoices.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground/70">
            No invoices generated yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/40 text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Invoice Number</th>
                  <th className="py-2.5 px-3">Billing Period</th>
                  <th className="py-2.5 px-3">Subtotal</th>
                  <th className="py-2.5 px-3">Tax Type & Rate</th>
                  <th className="py-2.5 px-3">Total (INR)</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/40">
                    <td className="py-3 px-3 font-semibold text-foreground">
                      {inv.invoice_number}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">
                      {new Date(inv.period_start).toLocaleDateString("en-IN")} -{" "}
                      {new Date(inv.period_end).toLocaleDateString("en-IN")}
                    </td>
                    <td className="py-3 px-3 text-foreground">
                      ₹{(Number(inv.subtotal_paise) / 100).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">
                      {inv.tax_type} ({inv.tax_rate_percent}%)
                    </td>
                    <td className="py-3 px-3 font-bold text-foreground">
                      ₹{(Number(inv.total_paise) / 100).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        {inv.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Checkout Modal Dialog */}
      {selectedPlanVersion && (
        <CheckoutDialog
          planVersionId={selectedPlanVersion.id}
          planName={selectedPlanVersion.name}
          pricePaise={selectedPlanVersion.pricePaise}
          billingPeriod={selectedPlanVersion.billingPeriod}
          isOpen={Boolean(selectedPlanVersion)}
          onClose={() => setSelectedPlanVersion(null)}
          onSuccess={() => {
            window.location.reload();
          }}
        />
      )}

      {/* Cancel Subscription Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-foreground">Cancel Subscription</h3>
            <p className="text-xs text-muted-foreground mt-2">
              Please choose when you would like your subscription cancellation to take effect:
            </p>
            {cancelError && (
              <p className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive" role="alert">
                {cancelError}
              </p>
            )}

            <div className="mt-4 space-y-3">
              <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/40">
                <input
                  type="radio"
                  name="cancelType"
                  checked={cancelAtPeriodEnd}
                  onChange={() => setCancelAtPeriodEnd(true)}
                  className="mt-0.5 text-primary"
                />
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    At the end of current billing cycle (Recommended)
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Keep active dialing and voice minutes until{" "}
                    {new Date(quotaStatus.periodEnd).toLocaleDateString("en-IN")}.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/40">
                <input
                  type="radio"
                  name="cancelType"
                  checked={!cancelAtPeriodEnd}
                  onChange={() => setCancelAtPeriodEnd(false)}
                  className="mt-0.5 text-primary"
                />
                <div>
                  <p className="text-xs font-semibold text-foreground">Immediately</p>
                  <p className="text-[11px] text-muted-foreground">
                    End subscription access immediately. Review active campaigns before continuing.
                  </p>
                </div>
              </label>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t pt-4">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                disabled={cancelling}
                className="px-4 py-2 text-xs font-semibold text-foreground bg-muted rounded-lg hover:bg-accent"
              >
                Keep Subscription
              </button>
              <button
                type="button"
                onClick={handleCancelSubscription}
                disabled={cancelling}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                {cancelling ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>Confirm Cancellation</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
