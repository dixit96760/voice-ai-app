import React from "react";
import Link from "next/link";
import { requireBusiness } from "@/lib/auth/session";
import NewCampaignForm from "./new-campaign-form";
import { ArrowLeft, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function NewCampaignPage() {
  await requireBusiness();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="h-8 px-2">
          <Link href="/campaigns">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Campaigns
          </Link>
        </Button>
      </div>

      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <Megaphone className="h-4 w-4" />
          <span>Step 1 of 6: Basic Information</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
          Create New Calling Campaign
        </h1>
        <p className="text-sm text-muted-foreground">
          Define the primary offering and objectives for this campaign.
        </p>
      </div>

      <NewCampaignForm />
    </div>
  );
}
