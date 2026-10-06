"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Building2,
  CalendarClock,
  CreditCard,
  Gauge,
  HelpCircle,
  LayoutDashboard,
  Megaphone,
  PhoneIncoming,
  Plug,
  Settings,
  ShieldCheck,
  Users,
  X,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";

const workspaceItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Campaigns", href: "/campaigns", icon: Megaphone },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Calls", href: "/calls", icon: PhoneIncoming },
  { name: "Callbacks", href: "/callbacks", icon: CalendarClock },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Usage", href: "/usage", icon: Gauge },
];

const accountItems = [
  { name: "Business profile", href: "/settings/business", icon: Building2 },
  { name: "Integrations", href: "/settings/integrations", icon: Plug },
  { name: "Security", href: "/settings/security", icon: ShieldCheck },
  { name: "Billing", href: "/billing", icon: CreditCard },
  { name: "Settings", href: "/settings", icon: Settings },
];

const supportItems = [{ name: "Documentation & help", href: "/help", icon: HelpCircle }];

type NavigationProps = {
  variant?: "desktop" | "mobile";
};

function isCurrentPath(pathname: string, href: string) {
  if (href === "/dashboard" || href === "/settings") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationLink({
  item,
  pathname,
  onNavigate,
  compact = false,
}: {
  item: (typeof workspaceItems)[number];
  pathname: string;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const Icon = item.icon;
  const active = isCurrentPath(pathname, item.href);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
        compact ? "py-3" : "",
        active
          ? "bg-primary/10 text-primary shadow-sm shadow-primary/5"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
        )}
        aria-hidden="true"
      />
      <span>{item.name}</span>
    </Link>
  );
}

function NavigationGroups({
  pathname,
  onNavigate,
  compact = false,
}: {
  pathname: string;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">
          Workspace
        </p>
        <div className="space-y-1">
          {workspaceItems.map((item) => (
            <NavigationLink
              key={item.href}
              item={item}
              pathname={pathname}
              onNavigate={onNavigate}
              compact={compact}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">
          Account
        </p>
        <div className="space-y-1">
          {accountItems.map((item) => (
            <NavigationLink
              key={item.href}
              item={item}
              pathname={pathname}
              onNavigate={onNavigate}
              compact={compact}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">
          Support
        </p>
        <div className="space-y-1">
          {supportItems.map((item) => (
            <NavigationLink
              key={item.href}
              item={item}
              pathname={pathname}
              onNavigate={onNavigate}
              compact={compact}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardNavigation({ variant = "desktop" }: NavigationProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (variant === "mobile") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground lg:hidden"
          aria-label="Open navigation menu"
          aria-expanded={open}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        {open && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
            <button
              type="button"
              className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-label="Close navigation menu"
            />
            <div className="relative flex h-full w-[min(86vw,22rem)] flex-col border-r bg-card p-4 shadow-2xl">
              <div className="mb-6 flex items-center justify-between px-2">
                <div>
                  <p className="text-sm font-bold">Workspace</p>
                  <p className="text-xs text-muted-foreground">Navigate your voice operation</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Close navigation menu"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <nav aria-label="Mobile navigation" className="flex-1 overflow-y-auto">
                <NavigationGroups pathname={pathname} onNavigate={() => setOpen(false)} compact />
              </nav>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <nav aria-label="Dashboard navigation" className="flex-1 overflow-y-auto px-4 py-4">
      <NavigationGroups pathname={pathname} />
    </nav>
  );
}
