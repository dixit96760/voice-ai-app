"use client";

import React, { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createBusinessAction, type BusinessActionResult } from "@/lib/business/actions";
import { BUSINESS_TYPES, IANA_TIMEZONES } from "@/lib/validation/business";
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
  ArrowRight,
  Building2,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Upload,
} from "lucide-react";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Creating your business...
        </>
      ) : (
        <>
          Complete Setup & Go to Dashboard
          <ArrowRight className="ml-2 h-4 w-4" />
        </>
      )}
    </Button>
  );
}

export default function OnboardingForm() {
  const [state, formAction] = useFormState<BusinessActionResult | null, FormData>(
    createBusinessAction,
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
    <Card className="rounded-2xl border-border/80 shadow-xl shadow-primary/5">
      <CardHeader className="space-y-1 border-b pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
            <Building2 className="h-4 w-4" />
            <span>Step 1 of 1: Business Information</span>
          </div>
          <span className="text-xs text-muted-foreground">* Required fields</span>
        </div>
        <CardTitle className="text-xl font-bold">Register Business Profile</CardTitle>
        <CardDescription>
          This profile represents your organization across all voice calling campaigns.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6">
        {state?.error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <form action={formAction} className="space-y-7">
          {/* Primary Business Identity */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">
                  Business / Company Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="businessName"
                  name="businessName"
                  type="text"
                  required
                  placeholder="e.g. ABC Properties"
                />
                {state?.fieldErrors?.businessName && (
                  <p className="text-xs text-destructive">{state.fieldErrors.businessName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessType">
                  Industry / Business Type <span className="text-destructive">*</span>
                </Label>
                <select
                  id="businessType"
                  name="businessType"
                  required
                  defaultValue="Real Estate"
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
              <Label htmlFor="description">Business Overview / Description</Label>
              <textarea
                id="description"
                name="description"
                rows={2}
                placeholder="Brief description of products, services, or properties offered..."
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              {state?.fieldErrors?.description && (
                <p className="text-xs text-destructive">{state.fieldErrors.description}</p>
              )}
            </div>
          </div>

          {/* Contact & Web Info */}
          <div className="border-t pt-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-muted-foreground" />
              Contact & Online Presence
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="website">Website URL</Label>
                <Input
                  id="website"
                  name="website"
                  type="url"
                  placeholder="https://example.com"
                />
                {state?.fieldErrors?.website && (
                  <p className="text-xs text-destructive">{state.fieldErrors.website}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessEmail">Support / Official Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="businessEmail"
                    name="businessEmail"
                    type="email"
                    className="pl-9"
                    placeholder="contact@example.com"
                  />
                </div>
                {state?.fieldErrors?.businessEmail && (
                  <p className="text-xs text-destructive">{state.fieldErrors.businessEmail}</p>
                )}
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
                    placeholder="+91 40 4000 1234"
                  />
                </div>
                {state?.fieldErrors?.businessPhone && (
                  <p className="text-xs text-destructive">{state.fieldErrors.businessPhone}</p>
                )}
              </div>
            </div>
          </div>

          {/* Location & Timezone */}
          <div className="border-t pt-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Location & Calling Timezone
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address">Headquarters Address</Label>
                <Input
                  id="address"
                  name="address"
                  type="text"
                  placeholder="e.g. Financial District, Gachibowli"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" name="city" type="text" placeholder="Hyderabad" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" name="state" type="text" placeholder="Telangana" />
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
                  defaultValue="India"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">
                  Default Timezone <span className="text-destructive">*</span>
                </Label>
                <select
                  id="timezone"
                  name="timezone"
                  defaultValue="Asia/Kolkata"
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {IANA_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz} className="bg-card text-foreground">
                      {tz} {tz === "Asia/Kolkata" ? "(Indian Standard Time)" : ""}
                    </option>
                  ))}
                </select>
                {state?.fieldErrors?.timezone && (
                  <p className="text-xs text-destructive">{state.fieldErrors.timezone}</p>
                )}
              </div>
            </div>
          </div>

          {/* Logo Upload */}
          <div className="border-t pt-4 space-y-2">
            <Label htmlFor="logo">Business Logo (Optional)</Label>
            <div className="flex items-center gap-4">
              <label
                htmlFor="logo"
                className="flex items-center gap-2 cursor-pointer rounded-md border border-dashed border-input bg-muted/40 px-4 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span>Choose Image file</span>
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

          <div className="border-t pt-7">
            <SubmitButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
