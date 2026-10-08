import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import CampaignWizard, { WizardAssignedContact } from "./campaign-wizard";
import type { Campaign, CampaignSource } from "@/lib/campaign/types";

export default async function CampaignEditPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const [params, searchParams] = await Promise.all([paramsPromise, searchParamsPromise]);
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const campaignId = params.id;
  const currentStep = Math.max(1, Math.min(6, Number(searchParams.step) || 1));

  // 1. Fetch Campaign
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("business_id", business.id)
    .is("deleted_at", null)
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

  // 3. Fetch Knowledge Sources
  const { data: sources } = await supabase
    .from("campaign_sources")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  // 4. Fetch Assigned Contacts
  const { data: assignedContactsData } = await supabase
    .from("campaign_contacts")
    .select(`
      id,
      contact_id,
      status,
      attempt_count,
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
    `)
    .eq("campaign_id", campaignId);

  // 5. Fetch Available Business Contacts
  const { data: businessContacts } = await supabase
    .from("contacts")
    .select("id, name, phone, email, city, tags, status, is_dnc")
    .eq("business_id", business.id)
    .eq("is_dnc", false)
    .order("name", { ascending: true })
    .limit(100);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="h-8 px-2">
          <Link href={`/campaigns/${campaignId}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Campaign Details
          </Link>
        </Button>
        <span className="text-xs text-muted-foreground font-mono">
          Campaign ID: {campaignId.slice(0, 8)}...
        </span>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" />
          Edit Campaign: {campaign.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure approved information, voice preferences, calling windows, and assigned audience.
        </p>
      </div>

      <CampaignWizard
        campaign={campaign as Campaign}
        activeVersion={activeVersion}
        sources={(sources || []) as CampaignSource[]}
        assignedContacts={(assignedContactsData as unknown as WizardAssignedContact[]) || []}
        businessContacts={businessContacts || []}
        initialStep={currentStep}
      />
    </div>
  );
}
