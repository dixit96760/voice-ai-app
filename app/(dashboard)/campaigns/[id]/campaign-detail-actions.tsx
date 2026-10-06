"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  validateAndMarkReadyAction,
  duplicateCampaignAction,
  deleteCampaignAction,
  restoreCampaignAction,
  pauseCampaignAction,
  resumeCampaignAction,
} from "@/lib/campaign/actions";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CheckCircle2,
  Edit,
  Copy,
  Trash2,
  RotateCcw,
  Loader2,
  AlertCircle,
  Play,
  Pause,
  BarChart3,
} from "lucide-react";
import CampaignLaunchDialog from "./campaign-launch-dialog";

interface CampaignDetailActionsProps {
  campaignId: string;
  campaignName: string;
  status: string;
  isDeleted: boolean;
  contactCount: number;
  callingWindow: string;
  callingDays: string;
  maxAttempts: number;
  callerPhone?: string;
  language: string;
  voicePersona: string;
}

export default function CampaignDetailActions({
  campaignId,
  campaignName,
  status,
  isDeleted,
  contactCount,
  callingWindow,
  callingDays,
  maxAttempts,
  callerPhone,
  language,
  voicePersona,
}: CampaignDetailActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [readinessErrors, setReadinessErrors] = useState<string[] | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [launchDialogOpen, setLaunchDialogOpen] = useState(false);

  const handleValidateAndMarkReady = async () => {
    setLoading(true);
    setActionError(null);
    setReadinessErrors(null);
    setActionSuccess(null);

    try {
      const res = await validateAndMarkReadyAction(campaignId);
      if (res.error) {
        setActionError(res.error);
        if (res.data && res.data.errors) {
          setReadinessErrors(res.data.errors.map((err) => err.message));
        }
      } else {
        setActionSuccess("Campaign successfully validated and marked as READY!");
        router.refresh();
      }
    } catch {
      setActionError("An unexpected error occurred while validating the campaign.");
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const res = await pauseCampaignAction(campaignId);
      if (res.error) {
        setActionError(res.error);
      } else {
        setActionSuccess(res.message || "Campaign paused.");
        router.refresh();
      }
    } catch {
      setActionError("Failed to pause campaign.");
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const res = await resumeCampaignAction(campaignId);
      if (res.error) {
        setActionError(res.error);
      } else {
        setActionSuccess(res.message || "Campaign resumed.");
        router.refresh();
      }
    } catch {
      setActionError("Failed to resume campaign.");
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const res = await duplicateCampaignAction(campaignId);
      if (res.error) {
        setActionError(res.error);
      } else if (res.data?.newCampaignId) {
        router.push(`/campaigns/${res.data.newCampaignId}`);
      }
    } catch {
      setActionError("Failed to duplicate campaign.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to move this campaign to the recycle bin? It can be restored within 30 days."
      )
    ) {
      return;
    }
    setLoading(true);
    setActionError(null);
    try {
      const res = await deleteCampaignAction(campaignId);
      if (res.error) {
        setActionError(res.error);
      } else {
        router.push("/campaigns");
      }
    } catch {
      setActionError("Failed to delete campaign.");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const res = await restoreCampaignAction(campaignId);
      if (res.error) {
        setActionError(res.error);
      } else {
        setActionSuccess("Campaign restored from recycle bin.");
        router.refresh();
      }
    } catch {
      setActionError("Failed to restore campaign.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {actionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Action Failed</AlertTitle>
          <AlertDescription className="space-y-1">
            <p>{actionError}</p>
            {readinessErrors && readinessErrors.length > 0 && (
              <ul className="list-disc pl-5 mt-2 space-y-0.5 text-xs">
                {readinessErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}

      {actionSuccess && (
        <Alert
          variant="default"
          className="border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{actionSuccess}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {isDeleted ? (
          <Button
            variant="outline"
            onClick={handleRestore}
            disabled={loading}
            className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            Restore Campaign
          </Button>
        ) : (
          <>
            {status === "DRAFT" && (
              <Button
                onClick={handleValidateAndMarkReady}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Validate &amp; Mark Ready
              </Button>
            )}

            {status === "READY" && (
              <Button
                onClick={() => setLaunchDialogOpen(true)}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Play className="mr-2 h-4 w-4" />
                Start Campaign
              </Button>
            )}

            {status === "RUNNING" && (
              <Button
                onClick={handlePause}
                disabled={loading}
                variant="outline"
                className="border-amber-500 text-amber-700 hover:bg-amber-50 dark:text-amber-400"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Pause className="mr-2 h-4 w-4" />
                )}
                Pause Dialing
              </Button>
            )}

            {status === "PAUSED" && (
              <Button
                onClick={handleResume}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Resume Dialing
              </Button>
            )}

            <Button variant="outline" asChild>
              <Link href={`/campaigns/${campaignId}/analytics`}>
                <BarChart3 className="mr-2 h-4 w-4 text-primary" />
                Funnel & Analytics
              </Link>
            </Button>

            <Button variant="outline" asChild>
              <Link href={`/campaigns/${campaignId}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Campaign
              </Link>
            </Button>

            <Button
              variant="outline"
              onClick={handleDuplicate}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              Duplicate
            </Button>

            {status !== "RUNNING" ? (
              <Button
                variant="ghost"
                onClick={handleDelete}
                disabled={loading}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">Pause before deleting</span>
            )}
          </>
        )}
      </div>

      {/* Confirmation Dialog */}
      <CampaignLaunchDialog
        open={launchDialogOpen}
        onClose={() => setLaunchDialogOpen(false)}
        campaignId={campaignId}
        campaignName={campaignName}
        contactCount={contactCount}
        callingWindow={callingWindow}
        callingDays={callingDays}
        maxAttempts={maxAttempts}
        callerPhone={callerPhone}
        language={language}
        voicePersona={voicePersona}
      />
    </div>
  );
}
