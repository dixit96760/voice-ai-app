import React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { ArrowLeft, History, UploadCloud, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
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

export default async function ContactImportsHistoryPage() {
  const business = await getCurrentBusiness();
  if (!business) {
    redirect("/onboarding");
  }

  const supabase = await createClient();
  const { data: imports } = await supabase
    .from("contact_imports")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
            <Link href="/contacts">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Contact Import History
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review past file uploads, processed batches, duplicate rates, and DNC exclusions.
            </p>
          </div>
        </div>

        <Button size="sm" asChild className="gap-1.5 h-8 text-xs">
          <Link href="/contacts/import">
            <UploadCloud className="h-4 w-4" />
            New Import
          </Link>
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="font-semibold text-xs">Source File</TableHead>
              <TableHead className="font-semibold text-xs">Type</TableHead>
              <TableHead className="font-semibold text-xs">Status</TableHead>
              <TableHead className="font-semibold text-xs text-right">Total Rows</TableHead>
              <TableHead className="font-semibold text-xs text-right">Imported</TableHead>
              <TableHead className="font-semibold text-xs text-right">Duplicates</TableHead>
              <TableHead className="font-semibold text-xs text-right">DNC Excluded</TableHead>
              <TableHead className="font-semibold text-xs text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!imports || imports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground text-sm">
                  No previous imports found. Upload your first list of leads to get started.
                </TableCell>
              </TableRow>
            ) : (
              imports.map((imp) => (
                <TableRow key={imp.id} className="text-xs hover:bg-muted/30">
                  <TableCell className="font-medium text-foreground">
                    <div>{imp.file_name}</div>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      ID: {imp.id.slice(0, 8)}...
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono">
                      {imp.source_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {imp.status === "COMPLETED" ? (
                      <Badge className="bg-emerald-500/10 text-emerald-700 border border-emerald-300 text-[10px] gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Completed
                      </Badge>
                    ) : imp.status === "PROCESSING" ? (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Clock className="h-3 w-3 animate-pulse" />
                        Processing
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px] gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {imp.status}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">{imp.total_rows}</TableCell>
                  <TableCell className="text-right font-semibold text-emerald-600">
                    {imp.imported_count}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{imp.duplicate_count}</TableCell>
                  <TableCell className="text-right text-destructive font-medium">
                    {imp.dnc_filtered_count}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {new Date(imp.created_at).toLocaleDateString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
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
