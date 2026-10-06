import React from "react";
import Link from "next/link";
import { getCurrentBusiness } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { ArrowLeft, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportWizardClient } from "./import-wizard-client";

export default async function ContactsImportPage() {
  const business = await getCurrentBusiness();
  if (!business) {
    redirect("/onboarding");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
            <Link href="/contacts">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-primary" />
              Import Contacts
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upload spreadsheets or sync Google Sheets directly into your {business.business_name} directory.
            </p>
          </div>
        </div>
      </div>

      <ImportWizardClient />
    </div>
  );
}
