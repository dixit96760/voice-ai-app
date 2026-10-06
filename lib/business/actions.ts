"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuth, getCurrentBusiness } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { businessOnboardingSchema } from "@/lib/validation/business";
import { uploadBusinessLogo } from "@/lib/storage/logo";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export interface BusinessActionResult {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  message?: string;
}

export async function createBusinessAction(
  prevState: BusinessActionResult | null,
  formData: FormData
): Promise<BusinessActionResult> {
  const user = await requireAuth();

  // Guard: User must not already own a business
  const existingBusiness = await getCurrentBusiness();
  if (existingBusiness) {
    redirect("/dashboard");
  }

  const rawData = {
    businessName: formData.get("businessName") as string,
    businessType: formData.get("businessType") as string,
    description: (formData.get("description") as string) || "",
    website: (formData.get("website") as string) || "",
    businessEmail: (formData.get("businessEmail") as string) || "",
    businessPhone: (formData.get("businessPhone") as string) || "",
    address: (formData.get("address") as string) || "",
    city: (formData.get("city") as string) || "",
    state: (formData.get("state") as string) || "",
    country: (formData.get("country") as string) || "India",
    timezone: (formData.get("timezone") as string) || "Asia/Kolkata",
    logoUrl: "",
  };

  const validation = businessOnboardingSchema.safeParse(rawData);
  if (!validation.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of validation.error.issues) {
      const field = issue.path[0] as string;
      fieldErrors[field] = issue.message;
    }
    return {
      error: "Please check the business information fields.",
      fieldErrors,
    };
  }

  // Handle optional logo upload
  const logoFile = formData.get("logo") as File | null;
  let uploadedLogoUrl: string | null = null;

  if (logoFile && logoFile.size > 0) {
    const uploadRes = await uploadBusinessLogo(user.id, logoFile);
    if (uploadRes.error) {
      return {
        error: `Logo upload failed: ${uploadRes.error}`,
      };
    }
    uploadedLogoUrl = uploadRes.logoUrl;
  }

  const supabase = await createClient();

  // Insert business record with owner_id strictly derived from authenticated session
  const { data: newBusiness, error: insertError } = await supabase
    .from("businesses")
    .insert({
      owner_id: user.id,
      business_name: validation.data.businessName,
      business_type: validation.data.businessType,
      description: validation.data.description || null,
      website: validation.data.website || null,
      business_email: validation.data.businessEmail || null,
      business_phone: validation.data.businessPhone || null,
      address: validation.data.address || null,
      city: validation.data.city || null,
      state: validation.data.state || null,
      country: validation.data.country,
      timezone: validation.data.timezone,
      logo_url: uploadedLogoUrl,
    })
    .select("*")
    .single();

  if (insertError) {
    // Check if unique constraint violation (duplicate click or existing business)
    if (insertError.code === "23505") {
      redirect("/dashboard");
    }
    return {
      error: "Failed to create business profile. Please try again.",
    };
  }

  // Initialize starter subscription for business
  if (newBusiness) {
    await supabase.from("subscriptions").insert({
      business_id: newBusiness.id,
      plan_name: "STARTER",
      status: "ACTIVE",
      billing_period: "MONTHLY",
      limits: {
        max_contacts: 2500,
        voice_minutes: 500,
        concurrent_calls: 2,
        recording_retention_days: 45,
      },
    });

    // Record audit log
    await supabase.from("audit_logs").insert({
      business_id: newBusiness.id,
      user_id: user.id,
      action: "SETTINGS_CHANGED",
      entity_type: "business",
      entity_id: newBusiness.id,
      new_values: {
        name: newBusiness.business_name,
        type: newBusiness.business_type,
        timezone: newBusiness.timezone,
      },
    });
  }

  redirect("/dashboard");
}

export async function updateBusinessSettingsAction(
  prevState: BusinessActionResult | null,
  formData: FormData
): Promise<BusinessActionResult> {
  const { userId, business } = await requirePermission("settings:manage");

  const rawData = {
    businessName: formData.get("businessName") as string,
    businessType: formData.get("businessType") as string,
    description: (formData.get("description") as string) || "",
    website: (formData.get("website") as string) || "",
    businessEmail: (formData.get("businessEmail") as string) || "",
    businessPhone: (formData.get("businessPhone") as string) || "",
    address: (formData.get("address") as string) || "",
    city: (formData.get("city") as string) || "",
    state: (formData.get("state") as string) || "",
    country: (formData.get("country") as string) || "India",
    timezone: (formData.get("timezone") as string) || "Asia/Kolkata",
    logoUrl: business.logo_url || "",
  };

  const validation = businessOnboardingSchema.safeParse(rawData);
  if (!validation.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of validation.error.issues) {
      const field = issue.path[0] as string;
      fieldErrors[field] = issue.message;
    }
    return {
      error: "Please correct the highlighted fields.",
      fieldErrors,
    };
  }

  // Handle optional new logo file
  const logoFile = formData.get("logo") as File | null;
  let finalLogoUrl = business.logo_url;

  if (logoFile && logoFile.size > 0) {
    const uploadRes = await uploadBusinessLogo(userId, logoFile);
    if (uploadRes.error) {
      return {
        error: `Logo upload failed: ${uploadRes.error}`,
      };
    }
    finalLogoUrl = uploadRes.logoUrl;
  }

  const supabase = await createClient();

  // Strictly update matching business owned by current user
  const { error: updateError } = await supabase
    .from("businesses")
    .update({
      business_name: validation.data.businessName,
      business_type: validation.data.businessType,
      description: validation.data.description || null,
      website: validation.data.website || null,
      business_email: validation.data.businessEmail || null,
      business_phone: validation.data.businessPhone || null,
      address: validation.data.address || null,
      city: validation.data.city || null,
      state: validation.data.state || null,
      country: validation.data.country,
      timezone: validation.data.timezone,
      logo_url: finalLogoUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", business.id);

  if (updateError) {
    return { error: "Failed to update business settings. Please try again." };
  }

  revalidatePath("/settings/business");
  revalidatePath("/dashboard");

  return {
    success: true,
    message: "Business settings saved successfully.",
  };
}
