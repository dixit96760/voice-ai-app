import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { validateCampaignReadiness } from "@/lib/campaign/validator";
import { getDefaultDialerNumbers } from "@/lib/providers/sarvam/config";
import type { Campaign, CampaignSource } from "@/lib/campaign/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Users,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  History,
  Clock,
  ShieldCheck,
  FileText,
  HelpCircle,
  Code,
} from "lucide-react";
import CampaignDetailActions from "./campaign-detail-actions";

export default async function CampaignDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = await paramsPromise;
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const campaignId = params.id;

  // 1. Fetch Campaign (including soft-deleted if viewing)
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("business_id", business.id)
    .single();

  if (!campaign) {
    notFound();
  }

  // 2. Fetch Active Version
  let activeVersion = null;
  if (campaign.active_version_id) {
    const { data: v } = await supabase
      .from("campaign_versions")
      .select("*")
      .eq("id", campaign.active_version_id)
      .single();
    activeVersion = v;
  }

  // 3. Fetch All Campaign Versions (History)
  const { data: versions } = await supabase
    .from("campaign_versions")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("version_number", { ascending: false });

  // 4. Fetch Knowledge Sources
  const { data: sources } = await supabase
    .from("campaign_sources")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  // 5. Fetch Assigned Contacts
  const { data: assignedContactsData, count: totalAssignedContacts } = await supabase
    .from("campaign_contacts")
    .select(
      `
      id,
      contact_id,
      status,
      attempt_count,
      last_call_at,
      contacts (
        id,
        name,
        phone,
        email,
        city,
        tags,
        status,
        is_dnc
      )
    `,
      { count: "exact" }
    )
    .eq("campaign_id", campaignId)
    .limit(20);

  // 6. Fetch Active Phone Number
  const { data: defaultPhone } = await supabase
    .from("phone_numbers")
    .select("phone_number")
    .eq("business_id", business.id)
    .eq("status", "ACTIVE")
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Launch dials from the platform pool when configured, so show that first.
  const callerPhone = getDefaultDialerNumbers()[0] || defaultPhone?.phone_number;

  // 7. Fetch Recent Campaign Calls & Telephony Metrics
  const { data: campaignCalls } = await supabase
    .from("calls")
    .select(`
      id,
      status,
      outcome,
      duration_seconds,
      provider_attempt_id,
      started_at,
      ended_at,
      interest_level,
      short_summary,
      contacts (name, phone)
    `)
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(15);

  // 8. Validate Readiness Scorecard
  const readiness = validateCampaignReadiness({
    campaign: campaign as Campaign,
    sources: (sources || []) as CampaignSource[],
    contactCount: totalAssignedContacts || 0,
    businessId: business.id,
  });

  const isDeleted = !!campaign.deleted_at;

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const formattedDays = (campaign.calling_days || [])
    .map((d: number) => dayNames[d])
    .join(", ");

  const config = (activeVersion?.configuration || {}) as Record<string, unknown>;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "READY":
        return <Badge variant="success">READY</Badge>;
      case "RUNNING":
        return <Badge className="bg-emerald-600 text-white animate-pulse">RUNNING</Badge>;
      case "PAUSED":
        return <Badge variant="warning">PAUSED</Badge>;
      case "COMPLETED":
        return <Badge variant="secondary">COMPLETED</Badge>;
      default:
        return <Badge variant="outline">DRAFT</Badge>;
    }
  };

  const callsList = (campaignCalls || []) as Array<{ status: string }>;
  const totalCallsCount = callsList.length;
  const connectedCallsCount =
    callsList.filter((c) => c.status === "COMPLETED" || c.status === "ANSWERED").length;
  const busyCallsCount = callsList.filter((c) => c.status === "BUSY").length;
  const noAnswerCallsCount = callsList.filter((c) => c.status === "NO_ANSWER").length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Breadcrumb / Nav */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-xs">
          <Link href="/campaigns">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Campaigns
          </Link>
        </Button>
        <span className="text-xs text-muted-foreground font-mono">
          ID: {campaign.id}
        </span>
      </div>

      {/* Recycle Bin Notice */}
      {isDeleted && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>This campaign is in the Recycle Bin</AlertTitle>
          <AlertDescription>
            It was soft-deleted on{" "}
            {new Date(campaign.deleted_at!).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}. It will
            be permanently removed after 30 days unless restored.
          </AlertDescription>
        </Alert>
      )}

      {/* Campaign Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 p-6 bg-card border rounded-lg shadow-sm">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {campaign.name}
            </h1>
            {getStatusBadge(campaign.status)}
            <Badge variant="outline">{campaign.offering_type}</Badge>
            {campaign.industry && (
              <Badge variant="secondary">{campaign.industry}</Badge>
            )}
            {campaign.sarvam_campaign_id && (
              <Badge variant="outline" className="font-mono text-[10px]">
                Sarvam ID: {campaign.sarvam_campaign_id.slice(0, 16)}...
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            {campaign.description || "No description provided."}
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
            <span>
              <strong>Objective:</strong> {campaign.objective || "General"}
            </span>
            <span>•</span>
            <span>
              <strong>Caller ID:</strong> {callerPhone || "Not configured"}
            </span>
            <span>•</span>
            <span>
              <strong>Timezone:</strong> {campaign.timezone || "Asia/Kolkata"}
            </span>
            <span>•</span>
            <span>
              <strong>Last Updated:</strong>{" "}
              {new Date(campaign.updated_at).toLocaleDateString("en-IN", {
                timeZone: "Asia/Kolkata",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        <div>
          <CampaignDetailActions
            campaignId={campaign.id}
            campaignName={campaign.name}
            status={campaign.status}
            isDeleted={isDeleted}
            contactCount={totalAssignedContacts || 0}
            callingWindow={`${campaign.calling_start_time?.slice(0, 5)} - ${campaign.calling_end_time?.slice(0, 5)} (${campaign.timezone || "IST"})`}
            callingDays={formattedDays || "Mon-Sat"}
            maxAttempts={campaign.max_attempts}
            callerPhone={callerPhone}
            language={String(config.language || "en-IN")}
            voicePersona={String(config.voiceId || "ananya-friendly")}
          />
        </div>
      </div>

      {/* Telephony Execution & Live Calls Summary Card */}
      {(campaign.status === "RUNNING" || campaign.status === "PAUSED" || totalCallsCount > 0) && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Live Telephony Execution Summary
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                Provider: Sarvam Voice Telephony
              </span>
            </CardTitle>
            <CardDescription className="text-xs">
              Real-time outbound dialing activity, connection rates, and attempt metrics.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 border rounded-md bg-muted/20">
                <span className="text-muted-foreground block text-[11px]">Calls Placed</span>
                <span className="font-bold text-lg text-foreground">{totalCallsCount}</span>
              </div>
              <div className="p-3 border rounded-md bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200">
                <span className="text-emerald-800 dark:text-emerald-300 block text-[11px]">Connected</span>
                <span className="font-bold text-lg text-emerald-700 dark:text-emerald-200">{connectedCallsCount}</span>
              </div>
              <div className="p-3 border rounded-md bg-amber-50/40 dark:bg-amber-950/20 border-amber-200">
                <span className="text-amber-800 dark:text-amber-300 block text-[11px]">Busy / No Answer</span>
                <span className="font-bold text-lg text-amber-700 dark:text-amber-200">{busyCallsCount + noAnswerCallsCount}</span>
              </div>
              <div className="p-3 border rounded-md bg-muted/20">
                <span className="text-muted-foreground block text-[11px]">Enrolled Audience</span>
                <span className="font-bold text-lg text-foreground">{totalAssignedContacts || 0}</span>
              </div>
            </div>

            {campaignCalls && campaignCalls.length > 0 && (
              <div className="border rounded-md overflow-hidden text-xs">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 text-[11px]">
                      <TableHead>Contact</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-right">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {((campaignCalls || []) as unknown as {
                      id: string;
                      status: string;
                      outcome: string | null;
                      duration_seconds: number;
                      ended_at: string | null;
                      contacts: { name: string; phone: string } | null;
                    }[]).map((call) => (
                      <TableRow key={call.id}>
                        <TableCell className="font-medium">
                          {call.contacts?.name || "Lead"}
                          <span className="text-[10px] text-muted-foreground block font-mono">
                            {call.contacts?.phone || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {call.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold">{call.outcome || "PENDING"}</span>
                        </TableCell>
                        <TableCell className="font-mono">{call.duration_seconds}s</TableCell>
                        <TableCell className="text-right text-muted-foreground text-[11px]">
                          {call.ended_at
                            ? new Date(call.ended_at).toLocaleTimeString("en-IN", {
                                timeZone: "Asia/Kolkata",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pre-flight Readiness Scorecard */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Pre-flight Readiness Scorecard
            </span>
            {readiness.ready ? (
              <Badge variant="success" className="text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                All Requirements Met
              </Badge>
            ) : (
              <Badge variant="warning" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {readiness.errors.length} Issue(s) Pending
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs">
            All checklist items must pass before a campaign can transition from DRAFT to READY state.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* 1. Basic Info */}
            <div className="flex items-start gap-2.5 p-3 rounded-md border bg-muted/20">
              {campaign.name && campaign.offering_type && campaign.description ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              )}
              <div className="text-xs space-y-0.5">
                <p className="font-medium text-foreground">Basic Profile</p>
                <p className="text-muted-foreground">
                  {campaign.name && campaign.offering_type
                    ? "Name & offering configured"
                    : "Missing required details"}
                </p>
              </div>
            </div>

            {/* 2. Knowledge Base */}
            <div className="flex items-start gap-2.5 p-3 rounded-md border bg-muted/20">
              {sources && sources.length > 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              )}
              <div className="text-xs space-y-0.5">
                <p className="font-medium text-foreground">Knowledge Base</p>
                <p className="text-muted-foreground">
                  {sources && sources.length > 0
                    ? `${sources.length} source(s) attached`
                    : "No knowledge attached"}
                </p>
              </div>
            </div>

            {/* 3. Audience Assigned */}
            <div className="flex items-start gap-2.5 p-3 rounded-md border bg-muted/20">
              {(totalAssignedContacts || 0) > 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              )}
              <div className="text-xs space-y-0.5">
                <p className="font-medium text-foreground">Assigned Audience</p>
                <p className="text-muted-foreground">
                  {(totalAssignedContacts || 0) > 0
                    ? `${totalAssignedContacts} contact(s) ready`
                    : "Zero contacts assigned"}
                </p>
              </div>
            </div>

            {/* 4. Calling Window */}
            <div className="flex items-start gap-2.5 p-3 rounded-md border bg-muted/20">
              {campaign.calling_days?.length > 0 &&
              campaign.calling_start_time &&
              campaign.calling_end_time &&
              campaign.calling_end_time > campaign.calling_start_time ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              )}
              <div className="text-xs space-y-0.5">
                <p className="font-medium text-foreground">Calling Rules</p>
                <p className="text-muted-foreground">
                  {campaign.calling_start_time?.slice(0, 5)} -{" "}
                  {campaign.calling_end_time?.slice(0, 5)} IST
                </p>
              </div>
            </div>
          </div>

          {!readiness.ready && (
            <div className="mt-3 p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-md">
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 mb-1">
                Action required before marking campaign READY:
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-xs text-amber-800 dark:text-amber-300">
                {readiness.errors.map((err, idx) => (
                  <li key={idx}>{err.message}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grid: AI Agent & Voice Persona + Calling Rules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* AI Agent Configuration */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              AI Agent &amp; Voice Persona
            </CardTitle>
            <CardDescription className="text-xs">
              Configured voice behavior, language, and system prompts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 pb-3 border-b">
              <div>
                <span className="text-muted-foreground block">Primary Language</span>
                <span className="font-medium text-foreground text-sm">
                  {String(config.language || "en-IN")}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Voice Persona</span>
                <span className="font-medium text-foreground text-sm">
                  {String(config.voiceId || "ananya-friendly")}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Tone of Voice</span>
                <span className="font-medium text-foreground">
                  {String(config.tone || "Friendly")}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Pacing / Speech Rate</span>
                <span className="font-medium text-foreground">
                  {String(config.speechRate || "1.0x")}
                </span>
              </div>
            </div>

            <div>
              <span className="text-muted-foreground block mb-1">Call Opening Greeting</span>
              <div className="p-2.5 bg-muted/40 rounded-md font-mono text-xs border">
                {(config.greeting as string) ||
                  `"Hello! Am I speaking with {contact_name}? I am calling from ${business.business_name} regarding our ${campaign.offering_type}."`}
              </div>
            </div>

            <div>
              <span className="text-muted-foreground block mb-1">System Instructions Template</span>
              <div className="p-2.5 bg-muted/40 rounded-md font-mono text-xs border max-h-36 overflow-y-auto whitespace-pre-wrap">
                {activeVersion?.system_instructions ||
                  "No custom system instructions defined."}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calling Schedule & Operational Rules */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              Calling Schedule &amp; Dialing Rules
            </CardTitle>
            <CardDescription className="text-xs">
              Telecom regulations, permissible calling hours, and pacing controls.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 pb-3 border-b">
              <div>
                <span className="text-muted-foreground block">Permissible Window</span>
                <span className="font-medium text-foreground text-sm flex items-center gap-1 mt-0.5">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  {campaign.calling_start_time?.slice(0, 5)} -{" "}
                  {campaign.calling_end_time?.slice(0, 5)} ({campaign.timezone || "IST"})
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Calling Days</span>
                <span className="font-medium text-foreground text-sm mt-0.5 block">
                  {formattedDays || "None configured"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-2.5 border rounded-md bg-muted/20">
                <span className="text-muted-foreground block text-[11px]">Max Retries</span>
                <span className="font-bold text-foreground text-base">
                  {campaign.max_attempts}
                </span>
                <span className="text-muted-foreground text-[10px] block">attempts/contact</span>
              </div>

              <div className="p-2.5 border rounded-md bg-muted/20">
                <span className="text-muted-foreground block text-[11px]">Retry Gap</span>
                <span className="font-bold text-foreground text-base">
                  {campaign.retry_interval_minutes}
                </span>
                <span className="text-muted-foreground text-[10px] block">minutes</span>
              </div>

              <div className="p-2.5 border rounded-md bg-muted/20">
                <span className="text-muted-foreground block text-[11px]">Max Duration</span>
                <span className="font-bold text-foreground text-base">
                  {Math.round((campaign.max_call_duration_seconds || 300) / 60)}
                </span>
                <span className="text-muted-foreground text-[10px] block">minutes/call</span>
              </div>
            </div>

            <div className="p-3 bg-muted/30 border rounded-md text-xs space-y-1">
              <p className="font-medium text-foreground flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                TRAI Compliance Constraints
              </p>
              <p className="text-muted-foreground text-[11px]">
                Standard outbound windows are automatically bounded between 09:00 and 20:00 IST to comply with Indian telecommunication guidelines.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Knowledge Sources */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Campaign Knowledge Sources ({sources?.length || 0})
            </CardTitle>
            <CardDescription className="text-xs">
              Knowledge base documents, FAQs, and custom text providing domain intelligence to the AI.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild className="text-xs h-8">
            <Link href={`/campaigns/${campaign.id}/edit?step=2`}>
              Manage Knowledge
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {!sources || sources.length === 0 ? (
            <div className="p-6 text-center border rounded-md border-dashed">
              <BookOpen className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">No knowledge sources attached</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Add business brochures, product FAQs, or pitch scripts to allow the AI agent to accurately answer prospect questions.
              </p>
              <Button size="sm" variant="outline" className="mt-3" asChild>
                <Link href={`/campaigns/${campaign.id}/edit?step=2`}>Add Knowledge Source</Link>
              </Button>
            </div>
          ) : (
            <div className="border rounded-md divide-y">
              {sources.map((source) => {
                const getSourceIcon = (type: string) => {
                  switch (type) {
                    case "DOCUMENT":
                      return <FileText className="h-4 w-4 text-blue-500" />;
                    case "FAQ":
                      return <HelpCircle className="h-4 w-4 text-emerald-500" />;
                    default:
                      return <Code className="h-4 w-4 text-purple-500" />;
                  }
                };

                return (
                  <div
                    key={source.id}
                    className="p-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {getSourceIcon(source.source_type)}
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {source.source_name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Type: {source.source_type} • Added on{" "}
                          {new Date(source.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
                          {source.raw_text && ` • ${source.raw_text.length} chars`}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {source.processing_status || "READY"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assigned Contacts Preview */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Assigned Calling Audience ({totalAssignedContacts || 0})
            </CardTitle>
            <CardDescription className="text-xs">
              Contacts enrolled in this campaign for outbound calls.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild className="text-xs h-8">
            <Link href={`/campaigns/${campaign.id}/edit?step=4`}>
              Manage Contacts
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {!assignedContactsData || assignedContactsData.length === 0 ? (
            <div className="p-6 text-center border rounded-md border-dashed">
              <Users className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">No contacts enrolled</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Assign contacts from your business directory to this campaign calling list.
              </p>
              <Button size="sm" variant="outline" className="mt-3" asChild>
                <Link href={`/campaigns/${campaign.id}/edit?step=4`}>Assign Contacts</Link>
              </Button>
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 text-[11px]">
                    <TableHead>Contact</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Call Status</TableHead>
                    <TableHead className="text-right">Attempts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((assignedContactsData || []) as unknown as {
                    id: string;
                    status: string;
                    attempt_count: number;
                    contacts: {
                      id: string;
                      name: string;
                      phone: string;
                      email: string | null;
                      city: string | null;
                    } | {
                      id: string;
                      name: string;
                      phone: string;
                      email: string | null;
                      city: string | null;
                    }[];
                  }[]).map((item) => {
                    const c = Array.isArray(item.contacts)
                      ? item.contacts[0]
                      : item.contacts;
                    if (!c) return null;

                    return (
                      <TableRow key={item.id} className="text-xs">
                        <TableCell className="font-medium">
                          {c.name || "Unknown"}
                          {c.email && (
                            <span className="text-[11px] text-muted-foreground block">
                              {c.email}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-[11px]">
                          {c.phone}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {c.city || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {item.status || "PENDING"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-[11px]">
                          {item.attempt_count || 0} / {campaign.max_attempts}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Version History */}
      {versions && versions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Version History ({versions.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Audit log of campaign revisions and published snapshots.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md divide-y">
              {versions.map((ver) => (
                <div
                  key={ver.id}
                  className="p-3 flex items-center justify-between hover:bg-muted/30 transition-colors text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        Version {ver.version_number}
                      </span>
                      {ver.id === campaign.active_version_id && (
                        <Badge variant="default" className="text-[10px] py-0">
                          Active
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] py-0">
                        {ver.status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Created: {new Date(ver.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                      {ver.published_at &&
                        ` • Published: ${new Date(ver.published_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`}
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    ID: {ver.id.slice(0, 8)}...
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
