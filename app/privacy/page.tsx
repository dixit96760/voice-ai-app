import Link from "next/link";
import { Metadata } from "next";
import { PhoneCall } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy | Sarvam Voice AI",
  description:
    "Privacy Policy for Sarvam Voice AI. Details regarding data processing, contact storage, voice call recordings, and compliance with Indian data protection laws.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPolicyPage() {
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
                Legal
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
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Last updated: October 2026 • Governing Law: Digital Personal Data Protection Act (DPDPA), India
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-base font-bold text-foreground">1. Overview & Scope</h2>
            <p className="mt-2">
              Sarvam Voice AI (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) provides automated B2B outbound telephony and AI voice agent orchestration services for business enterprises. This Privacy Policy outlines how we collect, store, process, and protect customer lead directories, contact data, call audio recordings, and bilingual conversation transcripts.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">2. Information We Process</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-foreground">Account & Identity Information:</strong> Business name, registered address, authorized representative email, phone number, and GSTIN.
              </li>
              <li>
                <strong className="text-foreground">Audience Contact Data:</strong> Lead phone numbers, prospect names, city, and metadata imported via CSV or CRM connectors by our enterprise customers.
              </li>
              <li>
                <strong className="text-foreground">Telephony Audio & Transcripts:</strong> Audio recordings of completed outbound calls, bilingual Indic/English text transcripts, intent labels, and call duration records.
              </li>
              <li>
                <strong className="text-foreground">Billing & Payment Data:</strong> Transaction tokens, subscription IDs, and invoice records processed via RBI-licensed payment aggregators (Razorpay). We do not store raw credit card numbers or UPI MPINs.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">3. Telecom & Do-Not-Call (DNC) Compliance</h2>
            <p className="mt-2">
              In accordance with Telecom Regulatory Authority of India (TRAI) guidelines, our platform automatically honors Do-Not-Call (DNC) requests. When a called party requests not to be called, their number is flagged and excluded from all future campaigns across that business tenant.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">4. Data Storage & Multi-Tenant Security</h2>
            <p className="mt-2">
              All customer directories, transcripts, and telemetry are isolated via multi-tenant Row Level Security (RLS) in encrypted PostgreSQL databases hosted in compliant data centers. Audio recordings are stored in private encrypted storage buckets accessible solely via time-limited cryptographically signed URLs.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">5. Data Retention & Deletion</h2>
            <p className="mt-2">
              Call recordings and transcripts are retained for the duration of the active customer subscription or as required by applicable telecom records regulations (up to 45 days default retention for audio recordings). Account owners may request permanent directory deletion by contacting our grievance officer.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-foreground">6. Grievance Officer & Contact</h2>
            <p className="mt-2">
              For any questions, grievances, or data subject access requests under the Digital Personal Data Protection Act, please contact our designated Grievance Officer via our{" "}
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
