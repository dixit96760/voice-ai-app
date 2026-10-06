import React from "react";
import Link from "next/link";
import { getCurrentBusiness } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  BarChart3,
  Megaphone,
  ArrowRight,
  PhoneCall,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function GlobalAnalyticsPage() {
  const business = await getCurrentBusiness();
  if (!business) {
    redirect("/onboarding");
  }

  const supabase = await createClient();

  // Fetch campaigns
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, status, created_at")
    .eq("business_id", business.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // Fetch all calls for business to calculate aggregate KPIs
  const { data: calls } = await supabase
    .from("calls")
    .select("campaign_id, status, outcome, duration_seconds")
    .eq("business_id", business.id);

  const totalCalls = calls?.length || 0;
  const answeredCalls = (calls || []).filter(
    (c) => c.status === "COMPLETED" || (c.duration_seconds && c.duration_seconds > 5)
  ).length;
  const interestedCalls = (calls || []).filter((c) => c.outcome === "INTERESTED").length;

  const globalConnectionRate =
    totalCalls > 0 ? Math.round((answeredCalls / totalCalls) * 100) : 0;
  const globalQualificationRate =
    answeredCalls > 0 ? Math.round((interestedCalls / answeredCalls) * 100) : 0;

  // Group call counts by campaign
  const campaignStatsMap: Record<
    string,
    { total: number; answered: number; interested: number }
  > = {};

  for (const c of calls || []) {
    if (!c.campaign_id) continue;
    if (!campaignStatsMap[c.campaign_id]) {
      campaignStatsMap[c.campaign_id] = { total: 0, answered: 0, interested: 0 };
    }
    const stat = campaignStatsMap[c.campaign_id];
    stat.total++;
    if (c.status === "COMPLETED" || (c.duration_seconds && c.duration_seconds > 5)) {
      stat.answered++;
    }
    if (c.outcome === "INTERESTED") {
      stat.interested++;
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Performance Analytics & Benchmarks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cross-campaign benchmarks, aggregate connection metrics, and funnel conversion tracking.
          </p>
        </div>
      </div>

      {/* Aggregate KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-card p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Global Connection Rate</p>
            <p className="text-2xl font-bold mt-1 text-primary">{globalConnectionRate}%</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {answeredCalls} of {totalCalls} calls connected
            </p>
          </div>
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <PhoneCall className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Lead Qualification Rate</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{globalQualificationRate}%</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {interestedCalls} high-intent prospects
            </p>
          </div>
          <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Active Campaigns</p>
            <p className="text-2xl font-bold mt-1">{campaigns?.length || 0}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Configured outreach programs</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <Megaphone className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Campaign Comparison Table */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="font-semibold text-xs">Campaign</TableHead>
              <TableHead className="font-semibold text-xs">Status</TableHead>
              <TableHead className="font-semibold text-xs text-right">Dials Made</TableHead>
              <TableHead className="font-semibold text-xs text-right">Answered</TableHead>
              <TableHead className="font-semibold text-xs text-right">Connected %</TableHead>
              <TableHead className="font-semibold text-xs text-right">Interested Leads</TableHead>
              <TableHead className="font-semibold text-xs text-right">Analytics</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!campaigns || campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground text-sm">
                  No campaigns created yet. Create a campaign to unlock performance analytics.
                </TableCell>
              </TableRow>
            ) : (
              campaigns.map((camp) => {
                const stat = campaignStatsMap[camp.id] || { total: 0, answered: 0, interested: 0 };
                const connRate = stat.total > 0 ? Math.round((stat.answered / stat.total) * 100) : 0;

                return (
                  <TableRow key={camp.id} className="text-xs hover:bg-muted/30">
                    <TableCell className="font-semibold text-foreground">
                      <Link href={`/campaigns/${camp.id}`} className="hover:underline">
                        {camp.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {camp.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{stat.total}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{stat.answered}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      {connRate}%
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-600">
                      {stat.interested}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-[11px] gap-1">
                        <Link href={`/campaigns/${camp.id}/analytics`}>
                          Funnel & Reports
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
