"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startCampaignAction } from "@/lib/campaign/actions";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Play,
  Loader2,
  AlertTriangle,
  PhoneCall,
  Clock,
  Users,
  ShieldCheck,
  X,
} from "lucide-react";

interface CampaignLaunchDialogProps {
  campaignId: string;
  campaignName: string;
  contactCount: number;
  callingWindow: string;
  callingDays: string;
  maxAttempts: number;
  callerPhone?: string;
  language: string;
  voicePersona: string;
  open: boolean;
  onClose: () => void;
}

export default function CampaignLaunchDialog({
  campaignId,
  campaignName,
  contactCount,
  callingWindow,
  callingDays,
  maxAttempts,
  callerPhone,
  language,
  voicePersona,
  open,
  onClose,
}: CampaignLaunchDialogProps) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, loading, onClose]);

  if (!open) return null;

  const handleLaunch = async () => {
    if (!confirmed) {
      setError("Please check the confirmation box to authorize outbound calling.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await startCampaignAction(campaignId);
      if (res.error) {
        setError(res.error);
      } else {
        onClose();
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred while launching the campaign.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="campaign-launch-title"
    >
      <div className="relative w-full max-w-lg space-y-4 rounded-2xl border bg-card p-6 shadow-2xl">
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

        <div className="flex items-center gap-2 text-primary">
          <PhoneCall className="h-6 w-6" />
          <h2 id="campaign-launch-title" className="text-xl font-bold tracking-tight text-foreground">
            Authorize &amp; Launch Campaign
          </h2>
        </div>

        <p className="text-xs text-muted-foreground">
          You are about to launch live outbound voice calling for{" "}
          <strong className="text-foreground">{campaignName}</strong>. Please verify the execution parameters below.
        </p>

        {error && (
          <Alert variant="destructive" className="py-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-xs font-semibold">Launch Failed</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {/* Parameters Checklist */}
        <div className="rounded-md border bg-muted/20 p-3.5 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" /> Target Audience
            </span>
            <span className="font-semibold text-foreground">
              {contactCount} contact(s) queued (DNC excluded)
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" /> Permissible Window
            </span>
            <span className="font-semibold text-foreground">
              {callingWindow} ({callingDays})
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" /> Dialing Rules
            </span>
            <span className="font-semibold text-foreground">
              Max {maxAttempts} attempts / contact
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <PhoneCall className="h-4 w-4 text-primary" /> Caller Number
            </span>
            <span className="font-mono font-semibold text-foreground">
              {callerPhone || "Configured Business Number"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">AI Voice &amp; Language</span>
            <span className="font-semibold text-foreground">
              {voicePersona} ({language})
            </span>
          </div>
        </div>

        {/* Explicit Confirmation Checkbox */}
        <div className="flex items-start gap-2.5 p-3 rounded-md border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
          <input
            type="checkbox"
            id="confirmLaunch"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <label htmlFor="confirmLaunch" className="text-xs text-foreground font-medium cursor-pointer">
            I confirm that this campaign has been reviewed and that outbound calls should be initiated according to these rules.
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={loading} className="text-xs">
            Cancel
          </Button>
          <Button
            onClick={handleLaunch}
            disabled={!confirmed || loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Start Campaign Dialing
          </Button>
        </div>
      </div>
    </div>
  );
}
