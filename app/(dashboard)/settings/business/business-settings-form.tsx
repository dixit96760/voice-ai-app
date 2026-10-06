"use client";

import React, { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  updateBusinessSettingsAction,
  type BusinessActionResult,
} from "@/lib/business/actions";
import { BUSINESS_TYPES, IANA_TIMEZONES } from "@/lib/validation/business";
import type { Business } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  Upload,
} from "lucide-react";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Saving Changes...
        </>
      ) : (
        <>
          <Save className="mr-2 h-4 w-4" />
          Save Business Settings
        </>
      )}
    </Button>
  );
}

export default function BusinessSettingsForm({
  initialBusiness,
}: {
  initialBusiness: Business;
}) {
  const [state, formAction] = useFormState<BusinessActionResult | null, FormData>(
    updateBusinessSettingsAction,
    null
  );
  const [logoFileName, setLogoFileName] = useState<string>("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("File size exceeds 2 MB limit.");
        e.target.value = "";
        setLogoFileName("");
        return;
      }
      setLogoFileName(file.name);
    } else {
      setLogoFileName("");
    }
  };

  return (
    <Card className="shadow-sm border-muted">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg font-bold">General Business Profile</CardTitle>
        </div>
        <CardDescription>
          Information used in voice campaign scripts and caller identity
        </CardDescription>
      </CardHeader>

      <CardContent>
        {state?.error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {state?.success && (
          <Alert variant="success" className="mb-6">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}

        <form action={formAction} className="space-y-6">
          {/* Identity */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">
                  Business Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="businessName"
                  name="businessName"
                  type="text"
                  required
                  defaultValue={initialBusiness.business_name}
                />
                {state?.fieldErrors?.businessName && (
                  <p className="text-xs text-destructive">{state.fieldErrors.businessName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessType">
                  Business / Industry Type <span className="text-destructive">*</span>
                </Label>
                <select
                  id="businessType"
                  name="businessType"
                  required
                  defaultValue={initialBusiness.business_type || "Real Estate"}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {BUSINESS_TYPES.map((type) => (
                    <option key={type} value={type} className="bg-card text-foreground">
                      {type}
                    </option>
                  ))}
                </select>
                {state?.fieldErrors?.businessType && (
                  <p className="text-xs text-destructive">{state.fieldErrors.businessType}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Business Overview</Label>
              <textarea
                id="description"
                name="description"
                rows={2}
                defaultValue={initialBusiness.description || ""}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* Contact */}
          <div className="border-t pt-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-muted-foreground" />
              Online Presence & Direct Contact
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="website">Website URL</Label>
                <Input
                  id="website"
                  name="website"
                  type="url"
                  defaultValue={initialBusiness.website || ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessEmail">Official Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="businessEmail"
                    name="businessEmail"
                    type="email"
                    className="pl-9"
                    defaultValue={initialBusiness.business_email || ""}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessPhone">Official Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="businessPhone"
                    name="businessPhone"
                    type="tel"
                    className="pl-9"
                    defaultValue={initialBusiness.business_phone || ""}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Location & Timezone */}
          <div className="border-t pt-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Calling Timezone & Location
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  name="address"
                  type="text"
                  defaultValue={initialBusiness.address || ""}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    name="city"
                    type="text"
                    defaultValue={initialBusiness.city || ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    name="state"
                    type="text"
                    defaultValue={initialBusiness.state || ""}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  name="country"
                  type="text"
                  defaultValue={initialBusiness.country || "India"}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">
                  Default Telephony Timezone <span className="text-destructive">*</span>
                </Label>
                <select
                  id="timezone"
                  name="timezone"
                  defaultValue={initialBusiness.timezone || "Asia/Kolkata"}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {IANA_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz} className="bg-card text-foreground">
                      {tz} {tz === "Asia/Kolkata" ? "(IST)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Logo */}
          <div className="border-t pt-4 space-y-2">
            <Label htmlFor="logo">Business Logo</Label>
            {initialBusiness.logo_url && (
              <div className="mb-2 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={initialBusiness.logo_url}
                  alt="Business Logo"
                  className="h-12 w-12 rounded object-cover border"
                />
                <span className="text-xs text-muted-foreground">Current logo</span>
              </div>
            )}
            <div className="flex items-center gap-4">
              <label
                htmlFor="logo"
                className="flex items-center gap-2 cursor-pointer rounded-md border border-dashed border-input bg-muted/40 px-4 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span>Upload New Logo</span>
                <input
                  id="logo"
                  name="logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
              <span className="text-xs text-muted-foreground truncate">
                {logoFileName || "Max 2MB (PNG, JPG, WebP, SVG)"}
              </span>
            </div>
          </div>

          <div className="border-t pt-6 flex justify-end">
            <SubmitButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
