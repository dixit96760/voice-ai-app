"use client";

import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[24rem] items-center justify-center">
      <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-xl font-bold">We couldn&apos;t load this view</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Something went wrong while loading your workspace. Try again, or return to the dashboard and
          try a different action.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button type="button" onClick={() => reset()}>
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
          <Button type="button" variant="outline" onClick={() => (window.location.href = "/dashboard")}>
            Go to dashboard
          </Button>
        </div>
        {error.digest && <p className="mt-5 text-[11px] text-muted-foreground">Reference: {error.digest}</p>}
      </div>
    </div>
  );
}
