"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  duplicateCampaignAction,
  deleteCampaignAction,
  restoreCampaignAction,
} from "@/lib/campaign/actions";
import { Button } from "@/components/ui/button";
import { Eye, Edit, Copy, Trash2, RotateCcw, Loader2 } from "lucide-react";

export default function CampaignListActions({
  campaignId,
  isDeleted,
  status,
}: {
  campaignId: string;
  isDeleted: boolean;
  status: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleDuplicate = async () => {
    setLoading(true);
    try {
      const res = await duplicateCampaignAction(campaignId);
      if (res.error) {
        alert(res.error);
      }
    } catch {
      alert("Failed to duplicate campaign.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to move this campaign to the recycle bin? It can be restored within 30 days.")) {
      return;
    }
    setLoading(true);
    try {
      const res = await deleteCampaignAction(campaignId);
      if (res.error) {
        alert(res.error);
      }
    } catch {
      alert("Failed to delete campaign.");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const res = await restoreCampaignAction(campaignId);
      if (res.error) {
        alert(res.error);
      }
    } catch {
      alert("Failed to restore campaign.");
    } finally {
      setLoading(false);
    }
  };

  if (isDeleted) {
    return (
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRestore}
          disabled={loading}
          className="text-xs h-8"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5 mr-1 text-emerald-600" />
          )}
          Restore
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-xs">
        <Link href={`/campaigns/${campaignId}`}>
          <Eye className="h-3.5 w-3.5 mr-1" />
          View
        </Link>
      </Button>

      <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-xs">
        <Link href={`/campaigns/${campaignId}/edit`}>
          <Edit className="h-3.5 w-3.5 mr-1" />
          Edit
        </Link>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleDuplicate}
        disabled={loading}
        className="h-8 px-2 text-xs"
        title="Duplicate Campaign"
        aria-label="Duplicate campaign"
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>

      {status === "RUNNING" ? (
        <span className="px-2 text-[11px] text-muted-foreground">Pause to delete</span>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={loading}
          className="h-8 px-2 text-xs text-destructive hover:text-destructive"
          title="Move to Recycle Bin"
          aria-label="Move campaign to recycle bin"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
