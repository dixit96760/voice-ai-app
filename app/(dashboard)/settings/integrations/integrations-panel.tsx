"use client";

import { useState } from "react";
import type { SarvamConfigStatus } from "@/lib/providers/sarvam/config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface VerifyResponse {
  ok: boolean;
  status: SarvamConfigStatus;
  error?: string;
  live?: {
    reachable: boolean;
    totalCampaigns?: number;
    code?: string;
    message?: string;
    recent?: Array<{ campaign_id: string; name: string; status: string }>;
  };
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-xs text-foreground">
        {value || "—"}
      </span>
    </div>
  );
}

export default function IntegrationsPanel({ status }: { status: SarvamConfigStatus }) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [copied, setCopied] = useState(false);

  async function verifyConnection() {
    setChecking(true);
    setResult(null);
    try {
      const res = await fetch("/api/integrations/sarvam/status?verify=1", {
        cache: "no-store",
      });
      setResult((await res.json()) as VerifyResponse);
    } catch {
      setResult({
        ok: false,
        status,
        error: "Could not reach the diagnostics endpoint.",
      });
    } finally {
      setChecking(false);
    }
  }

  async function copyWebhookUrl() {
    try {
      await navigator.clipboard.writeText(status.webhookUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Sarvam Voice Agents</CardTitle>
              <CardDescription>
                Outbound calling is executed by Sarvam Voice Agents. Campaigns use the
                scheduling API to create campaigns, stream contact cohorts and receive
                per-call results.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {status.mockMode && <Badge variant="warning">Mock mode</Badge>}
              <Badge variant={status.ready ? "success" : "destructive"}>
                {status.ready ? "Configured" : "Action required"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Row label="API base URL" value={status.baseUrl} />
            <Row
              label="API key"
              value={
                status.apiKeySource === "none"
                  ? null
                  : status.apiKeySource === "voice-agents"
                    ? "Voice Agents key"
                    : "shared (SARVAM_API_KEY)"
              }
            />
            {status.apiKeySource === "shared" && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Voice Agents uses a dedicated key. A Model API key in SARVAM_API_KEY is
                rejected by the scheduling API — add SARVAM_VOICE_AGENTS_API_KEY.
              </p>
            )}
            <Row label="Organisation" value={status.orgId} />
            <Row label="Workspace" value={status.workspaceId} />
            <Row label="Agent app id" value={status.agentAppId} />
            <Row
              label="Agent version"
              value={status.agentAppVersion ? String(status.agentAppVersion) : null}
            />
            <Row label="Telephony connection" value={status.connectionId} />
            <Row
              label="Dialer numbers"
              value={status.dialerNumbers.length ? status.dialerNumbers.join(", ") : null}
            />
            <Row
              label="Dial rate"
              value={`${status.attemptsPerSecond} attempt(s) per second`}
            />
            <Row label="Campaign window" value={`${status.campaignTtlDays} day(s)`} />
            <Row
              label="Cohort variables"
              value={status.cohortVariables.join(", ") || null}
            />
            <Row
              label="Webhook verification"
              value={
                status.webhookVerification === "none"
                  ? "not configured"
                  : status.webhookVerification
              }
            />
          </div>

          {status.missing.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-semibold">Missing configuration</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {status.missing.map((key) => (
                  <li key={key}>
                    <code className="font-mono text-xs">{key}</code> — {status.hints[key]}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {status.webhookVerification === "none" && !status.mockMode && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              Inbound call results will be rejected. Set{" "}
              <code className="font-mono text-xs">SARVAM_WEBHOOK_TOKEN</code> so the
              campaign webhook URL can be verified.
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">Campaign webhook URL</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="flex-1 truncate rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs">
                {status.webhookUrl}
              </code>
              <Button variant="outline" size="sm" onClick={copyWebhookUrl}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Sarvam must be able to reach this URL. On localhost, expose the app with a
              public tunnel and set NEXT_PUBLIC_APP_URL to that address.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={verifyConnection} disabled={checking || !status.ready}>
              {checking ? "Checking…" : "Verify connection"}
            </Button>
            {!status.ready && (
              <span className="text-xs text-muted-foreground">
                Complete the configuration above to enable verification.
              </span>
            )}
          </div>

          {result && (
            <div
              className={`rounded-xl border p-4 text-sm ${
                result.live?.reachable || result.ok
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                  : "border-destructive/40 bg-destructive/5 text-destructive"
              }`}
            >
              {result.live?.reachable ? (
                <div className="space-y-2">
                  <p className="font-semibold">
                    Connected to Sarvam — {result.live.totalCampaigns ?? 0} campaign(s) in
                    this workspace.
                  </p>
                  {result.live.recent && result.live.recent.length > 0 && (
                    <ul className="space-y-1 text-xs">
                      {result.live.recent.map((item) => (
                        <li key={item.campaign_id} className="font-mono">
                          {item.name} — {item.status}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-semibold">Sarvam is not reachable yet</p>
                  {result.live?.message && <p className="text-xs">{result.live.message}</p>}
                  {result.live?.code && (
                    <p className="text-xs">Code: {result.live.code}</p>
                  )}
                  {result.error && <p className="text-xs">{result.error}</p>}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
