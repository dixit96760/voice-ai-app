import Link from "next/link";
import { Metadata } from "next";
import {
  PhoneCall,
  Mail,
  Clock,
  MapPin,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Contact Us & Support | Sarvam Voice AI",
  description:
    "Get in touch with the Sarvam Voice AI team for enterprise voice inquiries, TRAI DLT assistance, support, and billing queries in India.",
  alternates: {
    canonical: "/contact",
  },
};

export default function ContactPage() {
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
                Support
              </span>
            </span>
          </Link>

          <div className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <Link href="/pricing" className="hover:text-foreground">
              Pricing
            </Link>
            <Link href="/contact" className="text-foreground font-semibold">
              Contact
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild className="text-violet-700 hover:bg-violet-50">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button
              asChild
              className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 text-white shadow-md shadow-fuchsia-500/20 hover:from-violet-700 hover:to-pink-600"
            >
              <Link href="/signup">
                Get started
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Get in touch</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            We&apos;re here to help your voice team succeed.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Have questions about regional Indian languages, TRAI DLT registration, or enterprise telephony routing? Reach out directly.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Card 1: Sales & Enterprise */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/10 text-violet-600">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-bold text-base">Enterprise & Sales</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Inquire about custom dial rates, high-concurrency pools, and custom SLA agreements.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t text-xs">
              <a
                href="mailto:sales@sarvamvoice.ai"
                className="font-medium text-primary hover:underline flex items-center gap-1.5"
              >
                <Mail className="h-3.5 w-3.5" />
                sales@sarvamvoice.ai
              </a>
            </div>
          </div>

          {/* Card 2: Technical & Billing Support */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-600/10 text-pink-600">
                <PhoneCall className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-bold text-base">Customer & Billing Desk</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Assistance with active campaigns, Razorpay invoices, and webhook configurations.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t text-xs">
              <a
                href="mailto:support@sarvamvoice.ai"
                className="font-medium text-primary hover:underline flex items-center gap-1.5"
              >
                <Mail className="h-3.5 w-3.5" />
                support@sarvamvoice.ai
              </a>
            </div>
          </div>

          {/* Card 3: Operating Hours */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-600">
                <Clock className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-bold text-base">Business Hours</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Monday to Saturday: 09:30 AM – 06:30 PM (IST)
              </p>
            </div>
            <div className="mt-6 pt-4 border-t text-xs text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              Bengaluru, Karnataka, India
            </div>
          </div>
        </div>

        {/* Support note */}
        <div className="mt-12 rounded-2xl border bg-muted/40 p-6 text-center text-xs text-muted-foreground">
          <p>
            Already an active customer? You can access instant diagnostics and Sarvam connection health via{" "}
            <Link href="/settings/integrations" className="text-primary font-medium hover:underline">
              Settings → Integrations
            </Link>{" "}
            inside your workspace.
          </p>
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
