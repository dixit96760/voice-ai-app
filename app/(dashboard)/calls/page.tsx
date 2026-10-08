import React from "react";
import Link from "next/link";
import { getCurrentBusiness } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { listCalls } from "@/lib/calls/call-service";
import { createClient } from "@/lib/supabase/server";
import {
  PhoneIncoming,
  Search,
  SlidersHorizontal,
  Volume2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CallStatus, CallOutcome } from "@/lib/supabase/types";

interface CallsPageProps {
  searchParams: Promise<{
    q?: string;
    campaignId?: string;
    status?: string;
    outcome?: string;
    page?: string;
  }>;
}

export default async function CallsPage({ searchParams: searchParamsPromise }: CallsPageProps) {
  const searchParams = await searchParamsPromise;
  const business = await getCurrentBusiness();
  if (!business) {
    redirect("/onboarding");
  }

  const supabase = await createClient();

  // Fetch campaigns for filter dropdown
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name")
    .eq("business_id", business.id)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  const searchQuery = searchParams.q?.trim() || "";
  const campaignId = searchParams.campaignId || undefined;
  const status = (searchParams.status as CallStatus) || undefined;
  const outcome = (searchParams.outcome as CallOutcome) || undefined;
  const page = parseInt(searchParams.page || "1", 10);

  const { calls, total } = await listCalls({
    businessId: business.id,
    campaignId,
    status,
    outcome,
    search: searchQuery,
    page,
    pageSize: 25,
  });

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const getOutcomeBadge = (out: string | null) => {
    switch (out) {
      case "INTERESTED":
        return <Badge className="bg-emerald-500/10 text-emerald-700 border border-emerald-300 text-[10px]">INTERESTED</Badge>;
      case "CALLBACK":
        return <Badge className="bg-blue-500/10 text-blue-700 border border-blue-300 text-[10px]">CALLBACK</Badge>;
      case "NOT_INTERESTED":
        return <Badge variant="secondary" className="text-[10px]">NOT INTERESTED</Badge>;
      case "BUSY":
        return <Badge variant="outline" className="text-[10px]">BUSY</Badge>;
      case "NO_ANSWER":
        return <Badge variant="outline" className="text-[10px]">NO ANSWER</Badge>;
      case "WRONG_NUMBER":
        return <Badge className="bg-amber-500/10 text-amber-700 border border-amber-300 text-[10px]">WRONG NO.</Badge>;
      case "DO_NOT_CALL":
        return <Badge variant="destructive" className="text-[10px]">DO NOT CALL</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{out || "—"}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <PhoneIncoming className="h-6 w-6 text-primary" />
            Outbound Call History
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review live call logs, inspect bilingual transcripts, listen to recordings, and track campaign outcomes.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground text-sm">{total}</span> total calls recorded
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-lg border shadow-sm">
        <form method="GET" action="/calls" className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={searchQuery}
            placeholder="Search by contact name, phone, or campaign..."
            className="pl-9 h-9 text-xs"
          />
        </form>

        <form method="GET" action="/calls" className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <input type="hidden" name="q" value={searchQuery} />
          <label htmlFor="campaign-filter" className="sr-only">
            Filter by campaign
          </label>
          <select
            id="campaign-filter"
            name="campaignId"
            defaultValue={campaignId || ""}
            className="h-9 min-w-36 rounded-lg border border-input bg-background px-3 text-xs shadow-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          >
            <option value="">All Campaigns</option>
            {campaigns?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label htmlFor="outcome-filter" className="sr-only">
            Filter by outcome
          </label>
          <select
            id="outcome-filter"
            name="outcome"
            defaultValue={outcome || ""}
            className="h-9 min-w-36 rounded-lg border border-input bg-background px-3 text-xs shadow-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          >
            <option value="">All Outcomes</option>
            <option value="INTERESTED">Interested</option>
            <option value="CALLBACK">Callback</option>
            <option value="NOT_INTERESTED">Not Interested</option>
            <option value="BUSY">Busy</option>
            <option value="NO_ANSWER">No Answer</option>
            <option value="WRONG_NUMBER">Wrong Number</option>
            <option value="DO_NOT_CALL">Do Not Call</option>
          </select>
          <Button type="submit" size="sm" variant="outline" className="h-9 gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            Apply
          </Button>
        </form>
      </div>

      {/* Calls Table */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="font-semibold text-xs">Contact</TableHead>
              <TableHead className="font-semibold text-xs">Campaign</TableHead>
              <TableHead className="font-semibold text-xs">Status</TableHead>
              <TableHead className="font-semibold text-xs">Outcome</TableHead>
              <TableHead className="font-semibold text-xs text-right">Duration</TableHead>
              <TableHead className="font-semibold text-xs">Audio</TableHead>
              <TableHead className="font-semibold text-xs text-right">Date / Time</TableHead>
              <TableHead className="font-semibold text-xs text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {calls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground text-sm">
                  No call records match your current filter criteria.
                </TableCell>
              </TableRow>
            ) : (
              calls.map((call) => (
                <TableRow key={call.id} className="text-xs hover:bg-muted/30">
                  <TableCell className="font-medium text-foreground">
                    <div>{call.contact_name}</div>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {call.contact_phone}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-muted-foreground">
                    <Link
                      href={`/campaigns/${call.campaign_id}`}
                      className="hover:underline hover:text-foreground"
                    >
                      {call.campaign_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {call.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{getOutcomeBadge(call.outcome)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatDuration(call.duration_seconds)}
                  </TableCell>
                  <TableCell>
                    {call.has_recording ? (
                      <span className="text-primary flex items-center gap-1" title="Recording available">
                        <Volume2 className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-[10px]">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground font-mono">
                    {new Date(call.created_at).toLocaleTimeString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      hour: "2-digit",
                      minute: "2-digit",
                      month: "short",
                      day: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-[11px] gap-1">
                      <Link href={`/calls/${call.id}`}>
                        View
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </Button>
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
