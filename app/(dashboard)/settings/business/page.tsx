import React from "react";
import { requireBusiness } from "@/lib/auth/session";
import BusinessSettingsForm from "./business-settings-form";

export default async function BusinessSettingsPage() {
  const { business } = await requireBusiness();

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Business Profile Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Update your organization profile, industry type, contact information, and calling timezone.
        </p>
      </div>

      <BusinessSettingsForm initialBusiness={business} />
    </div>
  );
}
