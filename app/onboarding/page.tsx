import React from "react";
import Link from "next/link";
import { ArrowLeft, Building2, PhoneCall, ShieldCheck } from "lucide-react";
import { requireNoBusiness } from "@/lib/auth/session";
import OnboardingForm from "./onboarding-form";

export default async function OnboardingPage() {
  await requireNoBusiness();

  return (
    <div className="relative min-h-screen overflow-hidden bg-muted/30 px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <div className="surface-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
        aria-hidden="true"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between">
        <Link href="/" className="group inline-flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform group-hover:scale-105">
            <PhoneCall className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-bold tracking-tight">Sarvam Voice AI</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Business setup
            </span>
          </span>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Back to home</span>
        </Link>
      </header>

      <main id="main-content" className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center py-10 sm:py-14">
        <div className="mb-8 max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary">
            <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
            One step to your workspace
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Let&apos;s set up your business profile.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            These details help your voice agents represent your business accurately across every
            campaign and conversation.
          </p>
        </div>

        <div className="w-full max-w-4xl">
          <OnboardingForm />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            Your information stays private
          </span>
          <span>Asia/Kolkata calling rules enabled</span>
        </div>
      </main>

      <footer className="relative z-10 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Sarvam Voice AI
      </footer>
    </div>
  );
}
