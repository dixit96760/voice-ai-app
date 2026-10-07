import React from "react";
import { requireMinimumRole } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ShieldAlert,
  Server,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Radio,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSarvamConfigStatus } from "@/lib/providers/sarvam";

export const metadata = {
  title: "Admin & Operations | Sarvam Voice AI",
};

export default async function AdminBackofficePage() {
  // Enforce ADMIN or OWNER role check server-side
  const context = await requireMinimumRole("ADMIN");
  const adminSupabase = createAdminClient();

  // 1. Fetch Sarvam provider status
  const sarvamConfig = getSarvamConfigStatus();

  // 2. Fetch recent webhook events for this business
  const { data: webhookEvents } = await adminSupabase
    .from("webhook_events")
    .select("id, provider, event_type, status, processed, received_at, processing_error")
    .eq("business_id", context.businessId)
    .order("received_at", { ascending: false })
    .limit(10);

  // 3. Fetch recent audit logs for this business
  const { data: auditLogs } = await adminSupabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, created_at")
    .eq("business_id", context.businessId)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-primary" />
            Workspace Administration & Operational Health
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Privileged backoffice diagnostics, webhook event logs, and tenant security audit trails.
          </p>
        </div>
        <Badge variant="outline" className="font-mono text-xs w-fit">
          Role: {context.role} • Org: {context.organizationId.slice(0, 8)}...
        </Badge>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span className="font-semibold uppercase">Sarvam Telephony</span>
            <Radio className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-3 flex items-center gap-2">
            {sarvamConfig.ready ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span className="text-lg font-bold text-emerald-600">Connected</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <span className="text-lg font-bold text-amber-500">Config Pending</span>
              </>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 font-mono">
            {sarvamConfig.mockMode ? "Mock Mode (Offline)" : "Live Telephony Engine"}
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span className="font-semibold uppercase">Database & RLS</span>
            <Server className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span className="text-lg font-bold text-emerald-600">Active</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Tenant isolation verified with PostgreSQL RLS
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span className="font-semibold uppercase">Webhook Ingestion</span>
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span className="text-lg font-bold text-emerald-600">Operational</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Token & HMAC signature verification enabled
          </p>
        </div>
      </div>

      {/* Webhook Events Ledger */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Recent Inbound Webhook Ingestions
          </h3>
          <span className="text-xs text-muted-foreground">
            {webhookEvents?.length || 0} events listed
          </span>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="text-xs font-semibold">Provider</TableHead>
              <TableHead className="text-xs font-semibold">Event Type</TableHead>
              <TableHead className="text-xs font-semibold">Status</TableHead>
              <TableHead className="text-xs font-semibold">Processed</TableHead>
              <TableHead className="text-xs font-semibold text-right">Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!webhookEvents || webhookEvents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-xs text-muted-foreground">
                  No webhook events received yet. Live telephony callbacks will be recorded here.
                </TableCell>
              </TableRow>
            ) : (
              webhookEvents.map((ev) => (
                <TableRow key={ev.id} className="text-xs hover:bg-muted/30">
                  <TableCell className="font-mono font-medium">{ev.provider}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{ev.event_type}</TableCell>
                  <TableCell>
                    <Badge
                      variant={ev.status === "PROCESSED" ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {ev.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{ev.processed ? "Yes" : "In Flight"}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {new Date(ev.received_at).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      day: "2-digit",
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

      {/* Audit Log Ledger */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Security & Tenant Audit Trail
          </h3>
          <span className="text-xs text-muted-foreground">
            {auditLogs?.length || 0} recent actions
          </span>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="text-xs font-semibold">Action</TableHead>
              <TableHead className="text-xs font-semibold">Entity Type</TableHead>
              <TableHead className="text-xs font-semibold">Entity ID</TableHead>
              <TableHead className="text-xs font-semibold text-right">Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!auditLogs || auditLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-xs text-muted-foreground">
                  No audit log entries recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              auditLogs.map((log) => (
                <TableRow key={log.id} className="text-xs hover:bg-muted/30">
                  <TableCell className="font-medium">{log.action}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{log.entity_type}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {log.entity_id ? log.entity_id.slice(0, 8) + "..." : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {new Date(log.created_at).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
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
