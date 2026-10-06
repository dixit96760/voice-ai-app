import Link from "next/link";
import { Metadata } from "next";
import { PhoneCall } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service | Sarvam Voice AI",
  description:
    "Terms of Service governing the use of the Sarvam Voice AI outbound telephony SaaS platform in India.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsOfServicePage() {
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
                Terms
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
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Terms of Service</h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Effective Date: October 2026 • Jurisdiction: Bengaluru, Karnataka, India
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-base font-bold text-foreground">1. Acceptance of Terms</h2>
            <p className="mt-2">
              By registering an account, importing contacts, or initiating calling campaigns via Sarvam Voice AI (&quot;the Service&quot;), you agree to comply with and be bound by these Terms of Service. If you are registering on behalf of a company or legal entity, you represent that you possess authority to bind said entity.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">2. Permitted Use & Telecom Regulations</h2>
            <p className="mt-2">
              Customers must utilize the platform strictly in accordance with applicable laws in India, including the Telecom Commercial Communications Customer Preference Regulations (TCCCPR) 2018 issued by TRAI. You explicitly agree:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1.5">
              <li>To place calls only during permissible calling windows (09:00 to 20:00 IST).</li>
              <li>Not to make unsolicited promotional calls to telephone numbers registered in National Do Not Call registers without explicit verifiable customer opt-in consent.</li>
              <li>Not to engage in abusive, defamatory, harassing, or fraudulent calling behaviors.</li>
              <li>To provide accurate business identity and caller representations during all voice interactions.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">3. Subscriptions, Invoicing & Taxes</h2>
            <p className="mt-2">
              Subscription plans are billed in Indian Rupees (INR) on recurring monthly or annual billing cycles through Razorpay. All fees are exclusive of Goods and Services Tax (GST 18%), which will be charged and reflected on official GST tax invoices according to the state code of the business customer.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">4. Fair Usage & Quotas</h2>
            <p className="mt-2">
              Each plan includes a defined allowance of voice minutes, contact directory slots, and campaign concurrency limits. Account dialing may be temporarily paused when monthly voice quotas are depleted until plan renewal or quota upgrade.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">5. Service Availability & Disclaimers</h2>
            <p className="mt-2">
              While we endeavor to provide continuous platform availability, telephony connections and underlying carrier routing are subject to third-party telecommunication infrastructure performance and network operator availability.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">6. Termination</h2>
            <p className="mt-2">
              We reserve the right to immediately suspend or terminate accounts that breach TRAI DLT regulations, initiate spam campaigns, or tamper with multi-tenant system integrity.
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
