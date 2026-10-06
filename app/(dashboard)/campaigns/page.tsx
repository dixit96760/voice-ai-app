import React from "react";
import Link from "next/link";
import { requireBusiness } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
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
import {
  Megaphone,
  Plus,
} from "lucide-react";
import CampaignListActions from "./campaign-list-actions";

export default async function CampaignsListPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const isRecycleBin = searchParams.filter === "recycle";

  // Fetch campaigns for this business
  let query = supabase
    .from("campaigns")
    .select(`
      id,
      name,
      offering_type,
      industry,
      objective,
      status,
      created_at,
      updated_at,
      deleted_at,
      campaign_contacts (count)
    `)
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  if (isRecycleBin) {
    query = query.not("deleted_at", "is", null);
  } else {
    query = query.is("deleted_at", null);
  }

  interface CampaignListItem {
    id: string;
    name: string;
    offering_type: string | null;
    industry: string | null;
    objective: string | null;
    status: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    campaign_contacts: { count: number }[];
  }

  const { data: campaigns } = await query;
  const campaignList = (campaigns || []) as unknown as CampaignListItem[];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Voice Campaigns
          </h1>
          <p className="text-sm text-muted-foreground">
            Build and manage tailored AI phone calling campaigns for your offerings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button asChild>
            <Link href="/campaigns/new">
              <Plus className="mr-2 h-4 w-4" />
              New Campaign
            </Link>
          </Button>
        </div>
      </div>

      {/* Tabs / Filter: Active vs Recycle Bin */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Link
            href="/campaigns"
            className={`px-3 py-1.5 rounded-md transition-colors ${
              !isRecycleBin
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Active Campaigns
          </Link>
          <Link
            href="/campaigns?filter=recycle"
            className={`px-3 py-1.5 rounded-md transition-colors ${
              isRecycleBin
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Recycle Bin (30-Day Recovery)
          </Link>
        </div>
        <span className="text-xs text-muted-foreground">
          {campaignList.length} campaign(s) listed
        </span>
      </div>

      {/* Campaigns Table or Empty State */}
      {campaignList.length === 0 ? (
        <Card className="border-dashed py-12 text-center">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
              <Megaphone className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg font-bold">
              {isRecycleBin ? "Recycle bin is empty" : "No campaigns yet"}
            </CardTitle>
            <CardDescription className="max-w-md mx-auto">
              {isRecycleBin
                ? "Deleted campaigns remain recoverable here for 30 days before permanent purging."
                : "Create your first campaign to configure approved knowledge, AI sales behavior, and calling rules."}
            </CardDescription>
          </CardHeader>
          {!isRecycleBin && (
            <CardContent>
              <Button asChild>
                <Link href="/campaigns/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Campaign
                </Link>
              </Button>
            </CardContent>
          )}
        </Card>
      ) : (
        <Card className="shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign Name</TableHead>
                <TableHead>Offering / Topic</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned Contacts</TableHead>
                <TableHead>Created / Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaignList.map((camp) => {
                const contactData = camp.campaign_contacts as unknown as { count: number }[];
                const contactCount = contactData?.[0]?.count || 0;
                const statusVariant: "success" | "info" | "warning" | "secondary" =
                  camp.status === "RUNNING"
                    ? "success"
                    : camp.status === "READY"
                    ? "info"
                    : camp.status === "PAUSED"
                    ? "warning"
                    : "secondary";

                return (
                  <TableRow key={camp.id}>
                    <TableCell className="font-semibold text-foreground">
                      <Link
                        href={`/campaigns/${camp.id}`}
                        className="hover:underline flex items-center gap-1.5"
                      >
                        {camp.name}
                      </Link>
                      {camp.objective && (
                        <span className="text-[11px] text-muted-foreground block font-normal">
                          Objective: {camp.objective}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{camp.offering_type || "—"}</span>
                      {camp.industry && (
                        <span className="text-[11px] text-muted-foreground block">
                          {camp.industry}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant}>{camp.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="font-semibold">{contactCount}</span> contacts
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div>
                        Created:{" "}
                        {new Date(camp.created_at).toLocaleDateString("en-IN", {
                          timeZone: "Asia/Kolkata",
                        })}
                      </div>
                      <div>
                        Updated:{" "}
                        {new Date(camp.updated_at).toLocaleDateString("en-IN", {
                          timeZone: "Asia/Kolkata",
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <CampaignListActions
                        campaignId={camp.id}
                        isDeleted={Boolean(camp.deleted_at)}
                        status={camp.status}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
