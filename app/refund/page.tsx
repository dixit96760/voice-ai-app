import Link from "next/link";
import { Metadata } from "next";
import { PhoneCall } from "lucide-react";

export const metadata: Metadata = {
  title: "Cancellation & Refund Policy | Sarvam Voice AI",
  description:
    "Cancellation and refund policy for subscriptions and voice minute allowances on Sarvam Voice AI.",
  alternates: {
    canonical: "/refund",
  },
};

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation Header */}
      <header className="border-b border-violet-100/80 bg-white/70 backdrop-blur-xl">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10"
        >
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-pink-500 text-white shadow-lg shadow-fuchsia-500/25">
              <PhoneCall className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-bold tracking-tight">Sarvam Voice AI</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Refunds
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link href="/contact" className="hover:text-foreground">Contact</Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-16 sm:px-8">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Cancellation & Refund Policy
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Last updated: October 2026 • Razorpay Payment Gateway Compliance
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-base font-bold text-foreground">1. Subscription Cancellation</h2>
            <p className="mt-2">
              Customers can cancel their recurring subscription at any time directly through the{" "}
              <strong className="text-foreground">Billing Settings</strong> dashboard. When you cancel:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-foreground">Cycle-End Cancellation:</strong> Your service will remain fully active with all campaign dialing features and remaining voice minutes intact until the end of your current billing period.
              </li>
              <li>
                <strong className="text-foreground">No Auto-Renewal:</strong> No further recurring debits or mandate charges will be placed on your UPI/card after cancellation.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">2. Refund Eligibility</h2>
            <p className="mt-2">
              Because voice minutes and telephony carrier dialing resources are provisioned in real time upon subscription activation, fees are generally non-refundable once calling usage has commenced.
            </p>
            <p className="mt-2">
              However, you are eligible for a <strong className="text-foreground">Full Refund</strong> under the following circumstances:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1.5">
              <li>Duplicate transaction or inadvertent double-charge on the same billing period.</li>
              <li>Subscription cancellation requested within 48 hours of initial purchase, provided zero outbound voice calls have been placed.</li>
              <li>Demonstrated platform failure where outbound dialing was unavailable for more than 72 consecutive hours due to core platform outages.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">3. Refund Processing Timeline</h2>
            <p className="mt-2">
              Approved refunds are credited back to the original payment source (UPI account, Net Banking, or Credit/Debit card) via Razorpay within 5 to 7 business days, in compliance with standard Reserve Bank of India (RBI) payment clearing cycles.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">4. How to Request a Refund</h2>
            <p className="mt-2">
              To request a refund, please send an email with your registered business email and invoice number to our billing desk via our{" "}
              <Link href="/contact" className="text-primary underline">
                Contact Page
              </Link>.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-violet-100 bg-gradient-to-r from-violet-50/50 via-background to-pink-50/50">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <p>© {new Date().getFullYear()} Sarvam Voice AI. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
            <Link href="/terms" className="hover:underline">Terms of Service</Link>
            <Link href="/refund" className="hover:underline">Cancellation & Refund</Link>
            <Link href="/contact" className="hover:underline">Contact Us</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
