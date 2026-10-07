"use client";

import React, { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateCallbackStatusAction } from "@/lib/calls/actions";
import { CheckCircle2, Loader2, RotateCcw, XCircle } from "lucide-react";

type CallbackStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export function CallbackStatusActions({
  callbackId,
  status,
}: {
  callbackId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const setStatus = (next: CallbackStatus) => {
    if (next === "CANCELLED" && !window.confirm("Cancel this callback request?")) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await updateCallbackStatusAction(callbackId, next);
      if (!res.success) {
        setError(res.error || "Failed to update callback.");
      }
    });
  };

  // QUEUED / CALLING callbacks are owned by the dialer until they finish.
  if (status === "QUEUED" || status === "CALLING") {
    return <span className="text-[11px] text-muted-foreground">In progress</span>;
  }

  if (pending) {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-auto" />;
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {status === "SCHEDULED" ? (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] gap-1 text-emerald-700"
            onClick={() => setStatus("COMPLETED")}
            title="Mark as done"
          >
            <CheckCircle2 className="h-3 w-3" />
            Done
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] gap-1 text-muted-foreground"
            onClick={() => setStatus("CANCELLED")}
            title="Cancel callback"
          >
            <XCircle className="h-3 w-3" />
            Cancel
          </Button>
        </>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px] gap-1 text-muted-foreground"
          onClick={() => setStatus("SCHEDULED")}
          title="Reopen callback"
        >
          <RotateCcw className="h-3 w-3" />
          Reopen
        </Button>
      )}
      {error && (
        <span className="text-[10px] text-destructive" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
