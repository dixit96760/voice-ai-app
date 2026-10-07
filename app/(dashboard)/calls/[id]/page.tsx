import React from "react";
import Link from "next/link";
import { getCurrentBusiness } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import { getCallDetail } from "@/lib/calls/call-service";
import { getCallRecordingSignedUrl } from "@/lib/calls/recording-service";
import {
  ArrowLeft,
  Phone,
  Calendar,
  Clock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  CalendarClock,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CallRecordingPlayer } from "./call-recording-player";
import { BilingualTranscriptViewer } from "./bilingual-transcript-viewer";

interface CallDetailPageProps {
  params: {
    id: string;
  };
}

export default async function CallDetailPage({ params }: CallDetailPageProps) {
  const business = await getCurrentBusiness();
  if (!business) {
    redirect("/onboarding");
  }

  const callData = await getCallDetail(params.id, business.id);
  if (!callData) {
    notFound();
  }

  const { call, contact, campaign, attempts, transcript, analysis, callback } = callData;

  // Retrieve temporary signed playback URL if call has a recording
  const { signedUrl } = await getCallRecordingSignedUrl(call.id, business.id);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const getOutcomeBadge = (outcome: string | null) => {
    switch (outcome) {
      case "INTERESTED":
        return <Badge className="bg-emerald-500/10 text-emerald-700 border border-emerald-300">INTERESTED</Badge>;
      case "CALLBACK":
        return <Badge className="bg-blue-500/10 text-blue-700 border border-blue-300">CALLBACK</Badge>;
      case "NOT_INTERESTED":
        return <Badge variant="secondary">NOT INTERESTED</Badge>;
      case "BUSY":
        return <Badge variant="outline">BUSY</Badge>;
      case "NO_ANSWER":
        return <Badge variant="outline">NO ANSWER</Badge>;
      case "WRONG_NUMBER":
        return <Badge className="bg-amber-500/10 text-amber-700 border border-amber-300">WRONG NUMBER</Badge>;
      case "DO_NOT_CALL":
        return <Badge variant="destructive">DO NOT CALL</Badge>;
      default:
        return <Badge variant="outline">{outcome || "UNKNOWN"}</Badge>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back nav & Actions */}
      <div className="flex items-center justify-between border-b pb-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 h-8 text-xs">
          <Link href="/calls">
            <ArrowLeft className="h-4 w-4" />
            Back to Calls
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          {getOutcomeBadge(call.outcome)}
          <Badge variant={call.status === "COMPLETED" ? "secondary" : "outline"} className="text-xs">
            {call.status}
          </Badge>
        </div>
      </div>

      {/* Main Call Summary Card */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">
                {contact?.name || "Lead"}
              </h1>
              {contact?.is_dnc && (
                <Badge variant="destructive" className="text-[10px]">
                  DNC
                </Badge>
              )}
              {contact?.is_wrong_number && (
                <Badge className="bg-amber-500/10 text-amber-700 border border-amber-300 text-[10px]">
                  Wrong Number
                </Badge>
              )}
            </div>
            <p className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              {contact?.phone || "No phone"}
              {contact?.city && ` • ${contact.city}`}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="text-right">
              <p className="font-semibold text-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-primary" />
                {formatDuration(call.duration_seconds)}
              </p>
              <p className="text-[11px]">Duration</p>
            </div>

            <div className="h-8 w-px bg-border" />

            <div className="text-right">
              <p className="font-semibold text-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                {new Date(call.created_at).toLocaleDateString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p className="text-[11px]">Initiated</p>
            </div>
          </div>
        </div>

        {campaign && (
          <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Campaign:{" "}
              <Link
                href={`/campaigns/${campaign.id}`}
                className="font-medium text-foreground hover:underline"
              >
                {campaign.name}
              </Link>
            </span>
            {call.interest_level && (
              <span>
                Interest Assessment:{" "}
                <strong className="text-foreground">{call.interest_level}</strong>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Audio Playback Player */}
      {signedUrl && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Call Audio Recording
          </h3>
          <CallRecordingPlayer
            signedUrl={signedUrl}
            durationSeconds={call.duration_seconds}
          />
        </div>
      )}

      {/* Callback Card (if requested) */}
      {callback && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-semibold text-xs text-blue-900">
                Scheduled Callback Request
              </h4>
              <p className="text-[11px] text-blue-700">
                Target: {new Date(callback.scheduled_for).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} • Status: {callback.status}
              </p>
            </div>
          </div>
          <Badge className="bg-blue-600 text-white text-[10px]">
            {callback.status}
          </Badge>
        </div>
      )}

      {/* AI Analysis & Summary Grid */}
      {analysis && (
        <div className="rounded-lg border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b pb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">AI Conversation Intelligence</h3>
            {analysis.intent && (
              <Badge variant="outline" className="text-[10px] ml-auto">
                Intent: {analysis.intent}
              </Badge>
            )}
          </div>

          {analysis.summary && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground">Executive Summary</h4>
              <p className="text-xs mt-1 text-foreground leading-relaxed">{analysis.summary}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {analysis.questions && analysis.questions.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Questions Asked by Customer
                </h4>
                <ul className="list-disc list-inside text-xs space-y-1 text-foreground">
                  {analysis.questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.objections && analysis.objections.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  Customer Objections
                </h4>
                <ul className="list-disc list-inside text-xs space-y-1 text-foreground">
                  {analysis.objections.map((obj, i) => (
                    <li key={i}>{obj}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {analysis.action_items && (
            <div className="pt-2 border-t">
              <h4 className="text-xs font-semibold text-muted-foreground">Recommended Next Action</h4>
              <p className="text-xs mt-1 font-medium text-primary">
                {analysis.action_items}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Bilingual Transcript */}
      <BilingualTranscriptViewer
        transcriptText={transcript?.transcript_text || call.short_summary || ""}
        transcriptJson={transcript?.transcript_json}
        language={transcript?.language}
      />

      {/* Call Attempt History Timeline */}
      <div className="rounded-lg border bg-card p-5 space-y-3 shadow-sm">
        <div className="flex items-center gap-2 border-b pb-3">
          <History className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Telephony Attempt Timeline</h3>
          <span className="text-xs text-muted-foreground ml-auto">
            {attempts.length} {attempts.length === 1 ? "attempt" : "attempts"}
          </span>
        </div>

        <div className="space-y-3">
          {attempts.map((att) => (
            <div
              key={att.id}
              className="flex items-start justify-between p-3 rounded-md border bg-muted/20 text-xs"
            >
              <div className="space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-2">
                  Attempt #{att.attempt_number}
                  <Badge variant="outline" className="text-[10px]">
                    {att.status}
                  </Badge>
                </p>
                {att.provider_attempt_id && (
                  <p className="text-[10px] font-mono text-muted-foreground">
                    Sarvam Attempt ID: {att.provider_attempt_id}
                  </p>
                )}
                {att.failure_reason && (
                  <p className="text-[11px] text-destructive">{att.failure_reason}</p>
                )}
              </div>

              <div className="text-right text-muted-foreground">
                <p className="font-mono">{formatDuration(att.duration_seconds)}</p>
                <p className="text-[10px]">
                  {new Date(att.created_at).toLocaleTimeString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
