import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bell,
  Building2,
  LogOut,
  PhoneCall,
  Search,
  User,
} from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { getCurrentUser, getCurrentProfile, getCurrentBusiness } from "@/lib/auth/session";
import { DashboardNavigation } from "@/components/dashboard/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const business = await getCurrentBusiness();

  if (!user) {
    redirect("/login");
  }

  if (!business) {
    redirect("/onboarding");
  }

  const profile = await getCurrentProfile();
  const businessName = business?.business_name || "Your business";
  const userFullName = profile?.full_name || user?.email?.split("@")[0] || "Business owner";
  const userEmail = profile?.email || user?.email || "";
  const initials = userFullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-muted/20 lg:flex">
      <aside className="hidden w-72 shrink-0 flex-col border-r bg-card lg:flex">
        <div className="flex h-20 items-center border-b px-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <PhoneCall className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-bold tracking-tight">ReachKaro AI</span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Voice operations
              </span>
            </span>
          </Link>
        </div>

        <div className="border-b px-4 py-4">
          <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{businessName}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Asia/Kolkata (IST)</p>
            </div>
          </div>
        </div>

        <DashboardNavigation />

        <div className="border-t p-4">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/settings/business"
              className="flex min-w-0 items-center gap-3 rounded-xl p-2 transition-colors hover:bg-accent"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {initials || <User className="h-4 w-4" aria-hidden="true" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold">{userFullName}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{userEmail}</span>
              </span>
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                title="Sign out"
                aria-label="Sign out"
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 lg:hidden">
              <DashboardNavigation variant="mobile" />
              <Link href="/dashboard" className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <PhoneCall className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="hidden text-sm font-bold sm:inline">ReachKaro AI</span>
              </Link>
            </div>

            <form method="GET" action="/contacts" className="relative hidden max-w-md flex-1 md:block">
              <label htmlFor="global-search" className="sr-only">
                Search contacts
              </label>
              <Search
                className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id="global-search"
                name="q"
                type="search"
                placeholder="Search contacts..."
                className="h-10 w-full rounded-lg border border-input bg-background/80 pl-9 pr-4 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              />
            </form>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                className="relative rounded-lg p-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              </button>
              <Link
                href="/settings/business"
                className="flex items-center gap-2 rounded-lg p-1.5 pr-2 transition-colors hover:bg-accent"
                aria-label="Open business settings"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground">
                  <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </span>
                <span className="hidden max-w-[10rem] truncate text-xs font-semibold sm:inline">
                  {businessName}
                </span>
              </Link>
              <form action={signOut} className="lg:hidden">
                <button
                  type="submit"
                  className="rounded-lg p-2.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </button>
              </form>
            </div>
          </div>
        </header>

        <main id="main-content" className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
