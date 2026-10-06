import React from "react";
import Link from "next/link";
import { getCurrentBusiness } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Megaphone,
  PhoneCall,
  Users,
  CalendarClock,
  Plus,
  ArrowUpRight,
  Radio,
  ArrowRight,
} from "lucide-react";
import { DashboardRealtimeListener } from "./realtime-listener";

export default async function DashboardPage() {
  const business = await getCurrentBusiness();
  if (!business) {
    redirect("/onboarding");
  }

  const supabase = await createClient();

  // 1. Fetch currently active (RUNNING or PAUSED) campaign
  const { data: activeCampaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("business_id", business.id)
    .in("status", ["RUNNING", "PAUSED"])
    .is("deleted_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 2. Fetch latest campaign if no running campaign
  const { data: latestCampaign } = !activeCampaign
    ? await supabase
        .from("campaigns")
        .select("*")
        .eq("business_id", business.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const displayCampaign = activeCampaign || latestCampaign;

  // 3. Campaign Stats for display campaign
  let totalEnrolledContacts = 0;
  let campaignCompletedCalls = 0;
  let campaignInterestedLeads = 0;
  let campaignCallbacksCount = 0;

  if (displayCampaign) {
    const { count: enrolled } = await supabase
      .from("campaign_contacts")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", displayCampaign.id);
    totalEnrolledContacts = enrolled || 0;

    const { count: completed } = await supabase
      .from("calls")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", displayCampaign.id)
      .eq("status", "COMPLETED");
    campaignCompletedCalls = completed || 0;

    const { count: interested } = await supabase
      .from("calls")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", displayCampaign.id)
      .eq("outcome", "INTERESTED");
    campaignInterestedLeads = interested || 0;

    const { count: callbacks } = await supabase
      .from("callbacks")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", displayCampaign.id);
    campaignCallbacksCount = callbacks || 0;
  }

  // 4. Global Business Metrics
  const { count: totalCallsCount } = await supabase
    .from("calls")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id);

  const { count: totalContactsCount } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id);

  const { count: pendingCallbacksCount } = await supabase
    .from("callbacks")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id)
    .eq("status", "SCHEDULED");

  // 5. Recent Calls Stream (last 6 calls)
  const { data: recentCalls } = await supabase
    .from("calls")
    .select(
      `
      id,
      campaign_id,
      status,
      outcome,
      duration_seconds,
      created_at,
      contacts (name, phone),
      campaigns (name)
    `
    )
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(6);

  // 6. Imminent Callbacks (next 4 scheduled)
  const { data: imminentCallbacks } = await supabase
    .from("callbacks")
    .select(
      `
      id,
      call_id,
      scheduled_for,
      status,
      notes,
      contacts (name, phone)
    `
    )
    .eq("business_id", business.id)
    .eq("status", "SCHEDULED")
    .order("scheduled_for", { ascending: true })
    .limit(4);

  const progressPercent =
    totalEnrolledContacts > 0
      ? Math.min(100, Math.round((campaignCompletedCalls / totalEnrolledContacts) * 100))
      : 0;

  return (
    <div className="space-y-8">
      {/* Realtime database listener */}
      <DashboardRealtimeListener businessId={business.id} />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Live Telephony Operations
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Realtime campaign progression, telephony throughput, and AI caller outcomes for {business.business_name}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild size="sm" className="h-9 text-xs">
            <Link href="/campaigns/new">
              <Plus className="mr-1.5 h-4 w-4" />
              New Campaign
            </Link>
          </Button>
        </div>
      </div>

      {/* Active Campaign Spotlight Card */}
      {displayCampaign ? (
        <Card className="border-primary/30 bg-card shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Radio
                  className={`h-4 w-4 ${
                    displayCampaign.status === "RUNNING"
                      ? "animate-pulse text-emerald-500"
                      : "text-muted-foreground"
                  }`}
                />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {displayCampaign.status === "RUNNING"
                    ? "Currently Dialing Campaign"
                    : "Primary Campaign"}
                </span>
                <Badge
                  variant={displayCampaign.status === "RUNNING" ? "default" : "secondary"}
                  className="text-[10px]"
                >
                  {displayCampaign.status}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                Calling Window: {displayCampaign.calling_start_time.slice(0, 5)} –{" "}
                {displayCampaign.calling_end_time.slice(0, 5)} (IST)
              </span>
            </div>
            <CardTitle className="text-xl font-bold mt-1">
              {displayCampaign.name}
            </CardTitle>
            <CardDescription className="line-clamp-2">
              {displayCampaign.description || displayCampaign.objective || "No description provided."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 pt-2">
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground font-medium">Enrolled Contacts</p>
                <p className="text-2xl font-bold mt-1">{totalEnrolledContacts}</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground font-medium">Completed Calls</p>
                <p className="text-2xl font-bold mt-1 text-primary">{campaignCompletedCalls}</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground font-medium">Interested Leads</p>
                <p className="text-2xl font-bold mt-1 text-emerald-600">{campaignInterestedLeads}</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground font-medium">Callbacks Scheduled</p>
                <p className="text-2xl font-bold mt-1 text-amber-600">{campaignCallbacksCount}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-48 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                </div>
                <span className="text-xs font-semibold text-muted-foreground">
                  {progressPercent}% Cohort Completed
                </span>
              </div>
              <Button variant="outline" size="sm" asChild className="text-xs h-8">
                <Link href={`/campaigns/${displayCampaign.id}`}>
                  Manage Campaign
                  <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-3">
            <Megaphone className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-semibold text-sm">No Active Campaigns</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Create a campaign, import leads, and initiate automated calling.
              </p>
            </div>
            <Button size="sm" asChild className="text-xs">
              <Link href="/campaigns/new">Create Your First Campaign</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Global Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-card p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Outbound Calls Placed</p>
            <p className="text-2xl font-bold mt-1">{totalCallsCount || 0}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <PhoneCall className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Managed Contacts</p>
            <p className="text-2xl font-bold mt-1">{totalContactsCount || 0}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Pending Follow-up Callbacks</p>
            <p className="text-2xl font-bold mt-1 text-blue-600">{pendingCallbacksCount || 0}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
            <CalendarClock className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 2-Column Split: Recent Live Calls Feed & Upcoming Callbacks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Calls Feed (2 cols) */}
        <div className="lg:col-span-2 rounded-2xl border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Live Outbound Call Stream</h3>
            </div>
            <Button variant="ghost" size="sm" asChild className="h-7 text-xs gap-1 text-muted-foreground">
              <Link href="/calls">
                All Calls
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>

          <div className="space-y-2">
            {!recentCalls || recentCalls.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">
                No recent calls. When outbound calls complete, they will appear here in real time.
              </p>
            ) : (
              (recentCalls as unknown as Array<{
                id: string;
                campaign_id: string;
                status: string;
                outcome: string | null;
                duration_seconds: number;
                created_at: string;
                contacts: { name: string; phone: string } | { name: string; phone: string }[] | null;
                campaigns: { name: string } | { name: string }[] | null;
              }> || []).map((c) => {
                const contact = Array.isArray(c.contacts) ? c.contacts[0] : c.contacts;
                const campaign = Array.isArray(c.campaigns) ? c.campaigns[0] : c.campaigns;

                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 rounded-md border bg-muted/20 text-xs hover:bg-muted/40 transition-colors"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{contact?.name || "Lead"}</span>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {contact?.phone}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {campaign?.name || "Campaign"} • {c.duration_seconds}s
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant={c.outcome === "INTERESTED" ? "default" : "outline"}
                        className="text-[10px]"
                      >
                        {c.outcome || c.status}
                      </Badge>
                      <Button variant="ghost" size="sm" asChild className="h-6 w-6 p-0">
                        <Link href={`/calls/${c.id}`} aria-label={`Open call ${c.id}`}>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Upcoming Callbacks (1 col) */}
        <div className="rounded-2xl border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-blue-600" />
              <h3 className="font-semibold text-sm">Upcoming Callbacks</h3>
            </div>
            <Button variant="ghost" size="sm" asChild className="h-7 text-xs gap-1 text-muted-foreground">
              <Link href="/callbacks">
                View All
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>

          <div className="space-y-2.5">
            {!imminentCallbacks || imminentCallbacks.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">
                No upcoming callbacks scheduled.
              </p>
            ) : (
              (imminentCallbacks as unknown as Array<{
                id: string;
                call_id: string | null;
                scheduled_for: string;
                status: string;
                notes: string | null;
                contacts: { name: string; phone: string } | { name: string; phone: string }[] | null;
              }> || []).map((cb) => {
                const contact = Array.isArray(cb.contacts) ? cb.contacts[0] : cb.contacts;
                return (
                  <div
                    key={cb.id}
                    className="p-3 rounded-md border border-blue-100 bg-blue-50/40 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-blue-950">{contact?.name || "Lead"}</span>
                      <span className="text-[10px] font-mono text-blue-700 font-semibold">
                        {new Date(cb.scheduled_for).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono">{contact?.phone}</p>
                    {cb.notes && (
                      <p className="text-[10px] text-blue-800 line-clamp-1 italic">{cb.notes}</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
