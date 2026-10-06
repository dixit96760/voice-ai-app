"use client";

import React, { useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportCampaignCallsAction } from "@/lib/analytics/actions";

interface CsvExportButtonProps {
  campaignId: string;
}

export function CsvExportButton({ campaignId }: CsvExportButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleExport = () => {
    setError(null);
    startTransition(async () => {
      const res = await exportCampaignCallsAction(campaignId);
      if (!res.success || !res.csv) {
        setError(res.error || "Failed to generate CSV export.");
        return;
      }

      // Create blob and trigger browser download
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", res.filename || "calls_export.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  return (
    <div>
      <Button
        onClick={handleExport}
        disabled={isPending}
        variant="outline"
        size="sm"
        className="gap-1.5 h-8 text-xs"
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        Export Calls (CSV)
      </Button>
      {error && <p className="text-[10px] text-destructive mt-1">{error}</p>}
    </div>
  );
}
