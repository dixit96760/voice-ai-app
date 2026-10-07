import React from "react";
import Link from "next/link";
import { getCurrentBusiness } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CalendarClock, ArrowRight } from "lucide-react";
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
import { CallbackStatusActions } from "./callback-status-actions";

export default async function CallbacksPage() {
  const business = await getCurrentBusiness();
  if (!business) {
    redirect("/onboarding");
  }

  const supabase = await createClient();

  const { data: callbacks } = await supabase
    .from("callbacks")
    .select(
      `
      id,
      call_id,
      contact_id,
      campaign_id,
      scheduled_for,
      status,
      notes,
      created_at,
      contacts (name, phone),
      campaigns (name)
    `
    )
    .eq("business_id", business.id)
    .order("scheduled_for", { ascending: true });

  const pendingCount = (callbacks || []).filter((cb) => cb.status === "SCHEDULED").length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-primary" />
            Scheduled Callbacks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Contacts who requested an agent follow-up or callback during automated AI phone calls.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{pendingCount}</span> pending of{" "}
          {callbacks?.length || 0} callback requests
        </div>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="font-semibold text-xs">Contact</TableHead>
              <TableHead className="font-semibold text-xs">Phone (+91)</TableHead>
              <TableHead className="font-semibold text-xs">Campaign</TableHead>
              <TableHead className="font-semibold text-xs">Requested Target</TableHead>
              <TableHead className="font-semibold text-xs">Status</TableHead>
              <TableHead className="font-semibold text-xs">Notes</TableHead>
              <TableHead className="font-semibold text-xs text-right">Source Call</TableHead>
              <TableHead className="font-semibold text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!callbacks || callbacks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground text-sm">
                  No pending callback requests. When prospects ask for a callback, they will appear here automatically.
                </TableCell>
              </TableRow>
            ) : (
              (callbacks as unknown as Array<{
                id: string;
                call_id: string | null;
                scheduled_for: string;
                status: string;
                notes: string | null;
                contacts: { name: string; phone: string } | { name: string; phone: string }[] | null;
                campaigns: { name: string } | { name: string }[] | null;
              }> || []).map((cb) => {
                const contact = Array.isArray(cb.contacts) ? cb.contacts[0] : cb.contacts;
                const campaign = Array.isArray(cb.campaigns) ? cb.campaigns[0] : cb.campaigns;

                return (
                  <TableRow key={cb.id} className="text-xs hover:bg-muted/30">
                    <TableCell className="font-medium text-foreground">
                      {contact?.name || "Lead"}
                    </TableCell>
                    <TableCell className="font-mono">{contact?.phone || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {campaign?.name || "Campaign"}
                    </TableCell>
                    <TableCell className="font-semibold text-primary">
                      {new Date(cb.scheduled_for).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={cb.status === "SCHEDULED" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {cb.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {cb.notes || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {cb.call_id ? (
                        <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-[11px] gap-1">
                          <Link href={`/calls/${cb.call_id}`}>
                            View Call
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </Button>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <CallbackStatusActions callbackId={cb.id} status={cb.status} />
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
