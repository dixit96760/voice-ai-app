import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Globe2,
  PhoneCall,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HomeMobileNav } from "@/components/marketing/mobile-nav";

const capabilities = [
  {
    icon: PhoneCall,
    title: "Sarvam telephony core",
    description:
      "Natural Indian-language voice agents with reliable outbound calling built for real conversations.",
    accent: "bg-gradient-to-br from-violet-600 to-pink-500 text-white shadow-lg shadow-violet-500/20",
  },
  {
    icon: ShieldCheck,
    title: "Compliance by default",
    description:
      "DNC protection, calling windows, and wrong-number safeguards are enforced before every campaign launches.",
    accent: "bg-gradient-to-br from-rose-500 to-orange-400 text-white shadow-lg shadow-rose-500/20",
  },
  {
    icon: BarChart3,
    title: "Actionable intelligence",
    description:
      "Turn every conversation into transcripts, intent signals, callbacks, and clear performance insights.",
    accent: "bg-gradient-to-br from-fuchsia-600 to-cyan-400 text-white shadow-lg shadow-fuchsia-500/20",
  },
];

const workflow = [
  ["01", "Import your audience", "Bring contacts from CSV or Google Sheets with smart column mapping."],
  ["02", "Shape the conversation", "Give your agent approved knowledge, language, tone, and calling rules."],
  ["03", "Learn and improve", "Review outcomes, transcripts, and callbacks while your campaigns evolve."],
] as const;

export default function HomePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "Sarvam Voice AI",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Cloud",
        description:
          "B2B outbound AI voice telephony platform for Indian businesses. Natural Hindi and Indian English voice agents, TRAI DNC compliance, and real-time transcripts.",
        offers: {
          "@type": "Offer",
          price: "2999",
          priceCurrency: "INR",
        },
      },
      {
        "@type": "Organization",
        name: "Sarvam Voice AI",
        url: "https://sarvamvoice.ai",
      },
    ],
  };

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <header className="relative z-10 border-b border-violet-100/80 bg-white/70 backdrop-blur-xl">
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
                B2B telephony
              </span>
            </span>
          </Link>

          <div className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a
              href="#capabilities"
              className="rounded-lg px-2 py-2 transition-colors hover:bg-accent hover:text-foreground"
            >
              Capabilities
            </a>
            <a
              href="#workflow"
              className="rounded-lg px-2 py-2 transition-colors hover:bg-accent hover:text-foreground"
            >
              How it works
            </a>
            <Link
              href="/pricing"
              className="rounded-lg px-2 py-2 transition-colors hover:bg-accent hover:text-foreground"
            >
              Pricing
            </Link>
            <Link
              href="/contact"
              className="rounded-lg px-2 py-2 transition-colors hover:bg-accent hover:text-foreground"
            >
              Contact
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              asChild
              className="hidden text-violet-700 hover:bg-violet-50 hover:text-violet-800 sm:inline-flex"
            >
              <Link href="/login">Sign in</Link>
            </Button>
            <Button
              asChild
              className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 text-white shadow-md shadow-fuchsia-500/20 hover:from-violet-700 hover:via-fuchsia-600 hover:to-pink-600"
            >
              <Link href="/signup">
                Get started
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <HomeMobileNav />
          </div>
        </nav>
      </header>

      <main id="main-content">
        <section className="relative isolate">
          <div className="surface-grid absolute inset-0 -z-10 opacity-60" aria-hidden="true" />
          <div
            className="absolute left-[12%] top-16 -z-10 h-72 w-72 rounded-full bg-violet-400/20 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="absolute right-[8%] top-28 -z-10 h-80 w-80 rounded-full bg-pink-400/20 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="absolute left-1/2 top-0 -z-10 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-300/10 blur-3xl"
            aria-hidden="true"
          />
          <div className="mx-auto max-w-7xl px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:px-10 lg:pb-28">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-gradient-to-r from-violet-50 via-fuchsia-50 to-pink-50 px-3.5 py-2 text-xs font-semibold text-violet-700">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                India-first voice intelligence for modern teams
              </div>
              <h1 className="text-balance text-4xl font-extrabold tracking-[-0.04em] sm:text-6xl lg:text-7xl">
                Turn every conversation into your next{" "}
                <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">
                  growth move.
                </span>
              </h1>
              <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
                Launch intelligent outbound campaigns that speak your customers&apos; language,
                qualify demand, and give your team the context to act—automatically.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  size="lg"
                  asChild
                  className="w-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 text-white shadow-lg shadow-fuchsia-500/25 hover:from-violet-700 hover:via-fuchsia-600 hover:to-pink-600 sm:w-auto"
                >
                  <Link href="/signup">
                    Start building free
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="w-full border-violet-200 bg-white/70 text-violet-700 hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-700 sm:w-auto"
                >
                  <Link href="/login">Explore the dashboard</Link>
                </Button>
              </div>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  No credit card required
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  Built for Indian businesses
                </span>
              </div>
            </div>

            <div className="mx-auto mt-16 max-w-5xl rounded-3xl border border-violet-200/80 bg-gradient-to-br from-white/90 via-violet-50/70 to-pink-50/80 p-2 shadow-2xl shadow-fuchsia-500/10 backdrop-blur sm:mt-20 sm:p-3">
              <div className="overflow-hidden rounded-2xl border border-border/70 bg-background">
                <div className="flex items-center justify-between border-b bg-card/80 px-4 py-3 sm:px-6">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    Campaign overview
                  </span>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                    Live
                  </span>
                </div>
                <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-6">
                  {[
                    ["Connected", "68%", "bg-gradient-to-r from-violet-500 to-fuchsia-500"],
                    ["Interested", "24%", "bg-gradient-to-r from-emerald-400 to-teal-400"],
                    ["Callbacks", "18", "bg-gradient-to-r from-amber-400 to-pink-400"],
                  ].map(([label, value, color]) => (
                    <div key={label} className="rounded-xl border bg-card p-4 shadow-sm">
                      <p className="text-xs font-medium text-muted-foreground">{label}</p>
                      <p className="mt-2 text-2xl font-bold">{value}</p>
                      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full w-2/3 rounded-full ${color}`} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mx-4 mb-4 rounded-xl border border-fuchsia-100 bg-gradient-to-r from-violet-50/80 via-fuchsia-50/80 to-pink-50/80 p-4 sm:mx-6 sm:mb-6">
                  <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div>
                      <p className="text-sm font-semibold">Your next best action</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        18 high-intent contacts are ready for a callback.
                      </p>
                    </div>
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-pink-500 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-fuchsia-500/20 transition-transform hover:scale-[1.02]"
                    >
                      Review leads
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="capabilities" className="scroll-mt-24 border-y border-violet-100 bg-gradient-to-b from-violet-50/80 via-background to-pink-50/60 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="max-w-2xl">
              <p className="eyebrow">One focused workspace</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Everything your voice team needs to move faster.
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                From the first contact list to the final callback, keep your entire outbound
                operation clear, compliant, and measurable.
              </p>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {capabilities.map(({ icon: Icon, title, description, accent }) => (
                <article
                  key={title}
                  className="group rounded-2xl border border-violet-100/80 bg-white/80 p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-fuchsia-200 hover:shadow-xl hover:shadow-fuchsia-500/10"
                >
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${accent}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="relative scroll-mt-24 overflow-hidden bg-gradient-to-b from-background via-violet-50/40 to-background py-20 sm:py-24">
          <div className="pointer-events-none absolute -right-24 top-20 h-64 w-64 rounded-full bg-pink-300/20 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-72 w-72 rounded-full bg-violet-300/20 blur-3xl" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:px-10">
            <div>
              <p className="eyebrow">A calmer way to call</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                From first import to follow-up, without the busywork.
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                Give your team a shared source of truth while the AI handles the repetitive work
                that slows good conversations down.
              </p>
              <Button
                variant="outline"
                asChild
                className="mt-7 border-violet-200 bg-white/70 text-violet-700 hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-700"
              >
                <Link href="/signup">
                  See the workflow
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
            <div className="space-y-3">
              {workflow.map(([number, title, description]) => (
                <div
                  key={number}
                  className="flex gap-4 rounded-2xl border border-violet-100/80 bg-white/80 p-5 shadow-sm transition-colors hover:border-fuchsia-200 hover:bg-fuchsia-50/30"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-sm font-bold text-white shadow-md shadow-violet-500/20">
                    {number}
                  </span>
                  <div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="safety" className="scroll-mt-24 px-5 pb-20 sm:px-8 sm:pb-24 lg:px-10">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-gradient-to-br from-violet-950 via-indigo-950 to-pink-950 px-6 py-10 text-white sm:px-10 sm:py-14 lg:px-16">
            <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-violet-400/20 blur-3xl" aria-hidden="true" />
            <div className="relative grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 text-primary-foreground/80">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                  <span className="text-xs font-bold uppercase tracking-[0.18em]">Built for trust</span>
                </div>
                <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                  Make every call feel considered—not automated.
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-7 text-white/70 sm:text-base">
                  Your business stays in control with approved knowledge, clear calling windows,
                  DNC safeguards, and an audit trail for every important action.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:min-w-[22rem]">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <Clock3 className="h-5 w-5 text-sky-300" aria-hidden="true" />
                  <p className="mt-4 text-sm font-semibold">IST-aware</p>
                  <p className="mt-1 text-xs text-background/55">Calling windows built in</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <Globe2 className="h-5 w-5 text-emerald-300" aria-hidden="true" />
                  <p className="mt-4 text-sm font-semibold">India-ready</p>
                  <p className="mt-1 text-xs text-background/55">Local language support</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-violet-100 bg-gradient-to-r from-violet-50/50 via-background to-pink-50/50">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
            <PhoneCall className="h-4 w-4 text-primary" aria-hidden="true" />
            Sarvam Voice AI
          </div>
          <div className="flex flex-wrap gap-4 text-xs font-medium">
            <Link href="/pricing" className="hover:text-foreground hover:underline">
              Pricing
            </Link>
            <Link href="/privacy" className="hover:text-foreground hover:underline">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground hover:underline">
              Terms of Service
            </Link>
            <Link href="/refund" className="hover:text-foreground hover:underline">
              Cancellation & Refund
            </Link>
            <Link href="/contact" className="hover:text-foreground hover:underline">
              Contact Us
            </Link>
          </div>
          <p>© {new Date().getFullYear()} Sarvam Voice AI. Built for modern Indian businesses.</p>
        </div>
      </footer>
    </div>
  );
}
