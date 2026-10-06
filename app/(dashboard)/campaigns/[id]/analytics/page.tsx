import React from "react";
import Link from "next/link";
import { getCurrentBusiness } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import { getCampaignAnalytics } from "@/lib/analytics/metrics-service";
import {
  ArrowLeft,
  BarChart3,
  Users,
  PhoneCall,
  CheckCircle2,
  CalendarClock,
  Sparkles,
  AlertTriangle,
  HelpCircle,
  Clock,
  PieChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CsvExportButton } from "./csv-export-button";

interface CampaignAnalyticsPageProps {
  params: {
    id: string;
  };
}

export default async function CampaignAnalyticsPage({ params }: CampaignAnalyticsPageProps) {
  const business = await getCurrentBusiness();
  if (!business) {
    redirect("/onboarding");
  }

  const report = await getCampaignAnalytics(params.id, business.id);
  if (!report) {
    notFound();
  }

  const { funnel, outcomes, insights } = report;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Navigation & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
            <Link href={`/campaigns/${params.id}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Campaign Performance Analytics
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Detailed conversion funnel, voice intelligence, and call outcomes for{" "}
              <strong className="text-foreground">{report.campaignName}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <CsvExportButton campaignId={params.id} />
        </div>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium">Connection Rate</p>
          <p className="text-2xl font-bold mt-1 text-primary">{funnel.connectionRatePercent}%</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {funnel.totalAnswered} of {funnel.totalDialed} answered
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium">Lead Qualification</p>
          <p className="text-2xl font-bold mt-1 text-emerald-600">{funnel.qualificationRatePercent}%</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {funnel.totalInterested} qualified leads
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium">Average Duration</p>
          <p className="text-2xl font-bold mt-1 text-foreground">
            {insights.averageDurationSeconds}s
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Per outbound dial</p>
        </div>

        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium">Total Voice Minutes</p>
          <p className="text-2xl font-bold mt-1 text-foreground">
            {insights.totalDurationMinutes}m
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Billable telephony time</p>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="rounded-lg border bg-card p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Campaign Conversion Funnel</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {funnel.totalEnrolled} total enrolled contacts
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
          {/* Step 1: Enrolled */}
          <div className="rounded-md border bg-muted/20 p-3 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10px] uppercase font-semibold">1. Enrolled</span>
              <Users className="h-3.5 w-3.5" />
            </div>
            <p className="text-lg font-bold">{funnel.totalEnrolled}</p>
            <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
              <div className="bg-primary h-full w-full" />
            </div>
            <p className="text-[10px] text-muted-foreground">100% of cohort</p>
          </div>

          {/* Step 2: Dialed */}
          <div className="rounded-md border bg-muted/20 p-3 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10px] uppercase font-semibold">2. Dialed</span>
              <PhoneCall className="h-3.5 w-3.5" />
            </div>
            <p className="text-lg font-bold">{funnel.totalDialed}</p>
            <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full"
                style={{
                  width: `${
                    funnel.totalEnrolled > 0
                      ? Math.min(100, (funnel.totalDialed / funnel.totalEnrolled) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {funnel.totalEnrolled > 0
                ? Math.round((funnel.totalDialed / funnel.totalEnrolled) * 100)
                : 0}
              % attempt rate
            </p>
          </div>

          {/* Step 3: Answered */}
          <div className="rounded-md border bg-muted/20 p-3 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10px] uppercase font-semibold">3. Answered</span>
              <Clock className="h-3.5 w-3.5" />
            </div>
            <p className="text-lg font-bold">{funnel.totalAnswered}</p>
            <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full"
                style={{
                  width: `${
                    funnel.totalDialed > 0
                      ? Math.min(100, (funnel.totalAnswered / funnel.totalDialed) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {funnel.connectionRatePercent}% connection rate
            </p>
          </div>

          {/* Step 4: Qualified */}
          <div className="rounded-md border bg-muted/20 p-3 space-y-1">
            <div className="flex items-center justify-between text-emerald-600">
              <span className="text-[10px] uppercase font-semibold">4. Qualified</span>
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
            <p className="text-lg font-bold text-emerald-600">{funnel.totalInterested}</p>
            <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-600 h-full"
                style={{
                  width: `${
                    funnel.totalAnswered > 0
                      ? Math.min(100, (funnel.totalInterested / funnel.totalAnswered) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {funnel.qualificationRatePercent}% interested
            </p>
          </div>

          {/* Step 5: Callback */}
          <div className="rounded-md border bg-muted/20 p-3 space-y-1">
            <div className="flex items-center justify-between text-blue-600">
              <span className="text-[10px] uppercase font-semibold">5. Callback</span>
              <CalendarClock className="h-3.5 w-3.5" />
            </div>
            <p className="text-lg font-bold text-blue-600">{funnel.totalCallbacks}</p>
            <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-full"
                style={{
                  width: `${
                    funnel.totalAnswered > 0
                      ? Math.min(100, (funnel.totalCallbacks / funnel.totalAnswered) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">Scheduled follow-up</p>
          </div>
        </div>
      </div>

      {/* 2-Column Split: Outcome Distribution & Voice Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Outcome Breakdown */}
        <div className="rounded-lg border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b pb-3">
            <PieChart className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Call Outcome Breakdown</h3>
          </div>

          <div className="space-y-3">
            {outcomes.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                No call outcomes recorded yet.
              </p>
            ) : (
              outcomes.map((item) => (
                <div key={item.outcome} className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <span>{item.outcome}</span>
                    <span className="text-muted-foreground">
                      {item.count} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        item.outcome === "INTERESTED"
                          ? "bg-emerald-500"
                          : item.outcome === "CALLBACK"
                          ? "bg-blue-500"
                          : item.outcome === "DO_NOT_CALL"
                          ? "bg-destructive"
                          : "bg-primary/70"
                      }`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Voice Intelligence: Objections & Questions */}
        <div className="rounded-lg border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b pb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Voice Intelligence Insights</h3>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-destructive flex items-center gap-1.5 mb-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                Top Customer Objections Detected
              </h4>
              {insights.topObjections.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">
                  No recurring objections recorded yet.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {insights.topObjections.map((obj, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded bg-muted/20 text-xs border"
                    >
                      <span className="truncate max-w-[80%]">{obj.objection}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {obj.count}x
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="text-xs font-semibold text-primary flex items-center gap-1.5 mb-2">
                <HelpCircle className="h-3.5 w-3.5" />
                Frequently Inquired Questions
              </h4>
              {insights.topQuestions.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">
                  No recurring inquiries logged yet.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {insights.topQuestions.map((q, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded bg-muted/20 text-xs border"
                    >
                      <span className="truncate max-w-[80%]">{q.question}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {q.count}x
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
