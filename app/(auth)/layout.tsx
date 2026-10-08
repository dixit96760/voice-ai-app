import React from "react";
import Link from "next/link";
import { PhoneCall, ShieldCheck, Sparkles } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-muted/30 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="surface-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -left-32 top-20 h-80 w-80 rounded-full bg-primary/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-32 bottom-10 h-96 w-96 rounded-full bg-sky-400/10 blur-3xl"
        aria-hidden="true"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between">
        <Link
          href="/"
          className="group inline-flex items-center gap-3"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform group-hover:scale-105">
            <PhoneCall className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="flex flex-col">
            <span className="text-lg font-bold tracking-tight">ReachKaro AI</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Intelligent outbound calling
            </span>
          </span>
        </Link>
        <Link
          href="/"
          className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
        >
          Back to home
        </Link>
      </header>

      <main id="main-content" className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 items-center justify-center py-10 sm:py-14">
        <div className="w-full max-w-md">
          <div className="mb-7 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Your voice operations workspace
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Welcome to a clearer way to call.
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Manage campaigns, contacts, and follow-up from one focused place.
            </p>
          </div>
          {children}
          <div className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            <span>Secure authentication · DNC-aware workflows · India-first calling</span>
          </div>
        </div>
      </main>

      <footer className="relative z-10 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} ReachKaro AI. Built for Indian businesses.
      </footer>
    </div>
  );
}
