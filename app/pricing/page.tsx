import Link from "next/link";
import { Metadata } from "next";
import {
  CheckCircle2,
  PhoneCall,
  ArrowRight,
  ShieldCheck,
  Zap,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Pricing Plans | ReachKaro AI",
  description:
    "Transparent, predictable B2B outbound AI voice telephony pricing. Tailored for Indian enterprises and growing teams with GST invoicing.",
  alternates: {
    canonical: "/pricing",
  },
};

const plans = [
  {
    name: "Starter",
    price: "₹2,999",
    period: "per month",
    description:
      "Perfect for small teams testing outbound voice automation and lead qualification.",
    highlight: false,
    cta: "Start with Starter",
    href: "/signup",
    features: [
      "500 Voice Minutes included",
      "Up to 2,500 Contact directory capacity",
      "1 Active concurrent campaign",
      "Automated Indian (+91) phone normalization",
      "TRAI DNC & wrong-number separation",
      "Standard Indic Hindi & English voices",
      "RFC-4180 CSV import & export",
      "Standard GST tax invoice (CGST/SGST/IGST)",
    ],
  },
  {
    name: "Growth",
    price: "₹7,999",
    period: "per month",
    description:
      "For growing sales and support teams requiring high-volume outbound calling with custom knowledge.",
    highlight: true,
    badge: "Most Popular",
    cta: "Scale with Growth",
    href: "/signup",
    features: [
      "3,000 Voice Minutes included",
      "Up to 10,000 Contact directory capacity",
      "1 Active concurrent campaign",
      "Bilingual Indic voice personas with code-switching",
      "Custom business knowledge grounding",
      "Automated callback scheduling & tracking",
      "Bilingual transcript & sentiment intelligence",
      "Smart phone rotation across telephony numbers",
      "Priority email & ticket support",
    ],
  },
  {
    name: "Enterprise",
    price: "₹19,999",
    period: "per month",
    description:
      "Dedicated infrastructure for high-scale B2B outbound campaigns and custom telephony requirements.",
    highlight: false,
    cta: "Talk to Sales",
    href: "/contact",
    features: [
      "10,000+ Voice Minutes allowance",
      "Unlimited Contact directory storage",
      "Custom campaign concurrency limits",
      "Custom Sarvam fine-tuned agent personas",
      "Assistance with TRAI DLT headers & KYC registration",
      "Dedicated SIP trunk / telephony carrier interconnect",
      "Full API access with developer keys",
      "Dedicated account manager & 99.9% uptime SLA",
    ],
  },
];

const faqs = [
  {
    q: "How does billing and minute metering work?",
    a: "Calls are metered based on connected duration rounded to the nearest minute ceiling. Unconnected calls (busy, invalid number, or no answer) do not consume voice minutes. Quota resets every monthly billing cycle.",
  },
  {
    q: "Are the prices inclusive of GST?",
    a: "Prices shown are exclusive of Indian Goods and Services Tax (GST 18%). GST is calculated at checkout with detailed CGST+SGST (intra-state) or IGST (inter-state) breakdowns on your registered GST invoice.",
  },
  {
    q: "Can I upgrade or cancel anytime?",
    a: "Yes. You can upgrade your plan or schedule a cancellation at the end of your billing cycle directly from your billing settings. No lock-in contracts.",
  },
  {
    q: "What payment methods are supported?",
    a: "We support all major Indian payment methods via Razorpay Subscriptions, including UPI Autopay, Net Banking, and Corporate Credit/Debit cards with recurring e-Mandates.",
  },
];

export default function PricingPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.a,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
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
              <span className="text-sm font-bold tracking-tight">ReachKaro AI</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Pricing
              </span>
            </span>
          </Link>

          <div className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <Link href="/pricing" className="text-foreground font-semibold">
              Pricing
            </Link>
            <Link href="/contact" className="hover:text-foreground">
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

      <main className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10">
        {/* Header Hero */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50/80 px-3.5 py-1.5 text-xs font-semibold text-violet-700">
            <Zap className="h-3.5 w-3.5" />
            Simple, Transparent Indian Pricing
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Choose the plan that fits your calling scale.
          </h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Every plan includes natural Indian regional voice personas, automated TRAI DNC
            safeguards, and compliant call recording.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative flex flex-col justify-between rounded-3xl border bg-card p-8 shadow-sm transition-all hover:shadow-xl ${
                p.highlight
                  ? "border-violet-400 ring-2 ring-violet-500/20 shadow-violet-500/10"
                  : "border-border"
              }`}
            >
              {p.badge && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-600 to-pink-500 px-3 py-1 text-[11px] font-bold text-white shadow-md">
                  {p.badge}
                </span>
              )}

              <div>
                <h3 className="text-xl font-bold">{p.name}</h3>
                <p className="mt-2 text-xs text-muted-foreground">{p.description}</p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tracking-tight">{p.price}</span>
                  <span className="text-xs text-muted-foreground font-medium">/{p.period}</span>
                </div>

                <div className="mt-8 space-y-3 border-t pt-6 text-xs text-muted-foreground">
                  {p.features.map((feat) => (
                    <div key={feat} className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 border-t pt-6">
                <Button
                  asChild
                  className={`w-full ${
                    p.highlight
                      ? "bg-gradient-to-r from-violet-600 to-pink-500 text-white shadow-md hover:from-violet-700 hover:to-pink-600"
                      : ""
                  }`}
                  variant={p.highlight ? "default" : "outline"}
                >
                  <Link href={p.href}>
                    {p.cta}
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Compliance & Trust Bar */}
        <div className="mt-16 rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50/50 via-background to-pink-50/50 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Enterprise Telecom & DNC Compliance</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Built specifically around TRAI calling windows, automated DNC suppression, and
                  Indian telecom regulatory safeguards.
                </p>
              </div>
            </div>
            <Button variant="outline" asChild className="shrink-0 text-xs">
              <Link href="/contact">Inquire for custom volume</Link>
            </Button>
          </div>
        </div>

        {/* FAQs */}
        <div className="mt-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Got questions?</p>
            <h2 className="mt-2 text-2xl font-bold">Frequently Asked Questions</h2>
          </div>

          <div className="mt-10 mx-auto max-w-3xl space-y-4">
            {faqs.map((faq) => (
              <div key={faq.q} className="rounded-xl border bg-card p-5 shadow-sm">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary" />
                  {faq.q}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-violet-100 bg-gradient-to-r from-violet-50/50 via-background to-pink-50/50">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <PhoneCall className="h-4 w-4 text-primary" />
            ReachKaro AI
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/pricing" className="hover:underline">Pricing</Link>
            <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
            <Link href="/terms" className="hover:underline">Terms of Service</Link>
            <Link href="/refund" className="hover:underline">Cancellation & Refund</Link>
            <Link href="/contact" className="hover:underline">Contact Us</Link>
          </div>
          <p>© {new Date().getFullYear()} ReachKaro AI. Built for modern Indian businesses.</p>
        </div>
      </footer>
    </div>
  );
}
