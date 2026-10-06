import React from "react";
import { getCurrentBusiness } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getBusinessUsageSummary } from "@/lib/usage/usage-service";
import {
  Gauge,
  PhoneCall,
  Clock,
  Sparkles,
  Volume2,
  Layers,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function UsagePage() {
  const business = await getCurrentBusiness();
  if (!business) {
    redirect("/onboarding");
  }

  const usage = await getBusinessUsageSummary(business.id);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Gauge className="h-6 w-6 text-primary" />
            Telephony & AI Usage Metering
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track consumption across voice minutes, outbound calls, audio recordings, and AI conversation analyses.
          </p>
        </div>
      </div>

      {/* Consumption Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">Voice Minutes</span>
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-1">
            {usage.totalDurationMinutes} min
          </p>
          <p className="text-[11px] text-muted-foreground">
            {usage.totalDurationSeconds} billable seconds
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">Outbound Dials</span>
            <PhoneCall className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-1">
            {usage.totalOutboundAttempts}
          </p>
          <p className="text-[11px] text-muted-foreground">Telephony carrier attempts</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">AI Analyses</span>
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-1">
            {usage.totalAiAnalysisCount}
          </p>
          <p className="text-[11px] text-muted-foreground">Post-call intelligence extraction</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase">Recordings Stored</span>
            <Volume2 className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-1">
            {usage.totalRecordingsCount}
          </p>
          <p className="text-[11px] text-muted-foreground">Encrypted private audio files</p>
        </div>
      </div>

      {/* Billable Usage Ledger */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Recent Billable Telephony Events
          </h3>
          <span className="text-xs text-muted-foreground">
            {usage.recentEvents.length} recorded events
          </span>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="font-semibold text-xs">Event Type</TableHead>
              <TableHead className="font-semibold text-xs">Quantity</TableHead>
              <TableHead className="font-semibold text-xs">Unit</TableHead>
              <TableHead className="font-semibold text-xs text-right">Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usage.recentEvents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-28 text-center text-muted-foreground text-sm">
                  No billable events recorded yet for this billing cycle.
                </TableCell>
              </TableRow>
            ) : (
              usage.recentEvents.map((ev) => (
                <TableRow key={ev.id} className="text-xs hover:bg-muted/30">
                  <TableCell className="font-mono text-foreground font-medium">
                    {ev.event_type}
                  </TableCell>
                  <TableCell className="font-semibold text-primary">{ev.quantity}</TableCell>
                  <TableCell className="text-muted-foreground uppercase text-[10px]">
                    {ev.unit}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground font-mono">
                    {new Date(ev.created_at).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
