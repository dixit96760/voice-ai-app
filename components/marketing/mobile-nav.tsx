"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const sectionLinks = [
  { label: "Capabilities", href: "#capabilities" },
  { label: "How it works", href: "#workflow" },
  { label: "Safety", href: "#safety" },
];

export function HomeMobileNav() {
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

  const closeMenu = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-violet-200 bg-white/80 text-violet-700 shadow-sm transition-colors hover:bg-violet-50 md:hidden"
        aria-label="Open home page menu"
        aria-expanded={open}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Home page menu">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={closeMenu}
            aria-label="Close home page menu"
          />
          <div className="relative ml-auto flex h-full w-[min(88vw,22rem)] flex-col border-l border-violet-100 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">Explore ReachKaro AI</p>
                <p className="mt-1 text-xs text-muted-foreground">Choose where to go next</p>
              </div>
              <button
                type="button"
                onClick={closeMenu}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-violet-50 hover:text-violet-700"
                aria-label="Close home page menu"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <nav aria-label="Home page sections" className="mt-8 space-y-1">
              {sectionLinks.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-violet-50 hover:text-violet-700"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="mt-auto space-y-3 border-t border-violet-100 pt-5">
              <Button variant="outline" asChild className="w-full border-violet-200 text-violet-700 hover:bg-violet-50">
                <Link href="/login" onClick={closeMenu}>
                  Sign in
                </Link>
              </Button>
              <Button
                asChild
                className="w-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 text-white shadow-lg shadow-fuchsia-500/20 hover:from-violet-700 hover:via-fuchsia-600 hover:to-pink-600"
              >
                <Link href="/signup" onClick={closeMenu}>
                  Get started
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
