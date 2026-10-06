"use client";

import React from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createCampaignDraftAction, type CampaignActionResult } from "@/lib/campaign/actions";
import { CAMPAIGN_OBJECTIVES, CAMPAIGN_INDUSTRIES } from "@/lib/validation/campaign";
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
import { AlertCircle, ArrowRight, Loader2, Sparkles } from "lucide-react";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Initializing Campaign Draft...
        </>
      ) : (
        <>
          Continue to Campaign Knowledge
          <ArrowRight className="ml-2 h-4 w-4" />
        </>
      )}
    </Button>
  );
}

export default function NewCampaignForm() {
  const [state, formAction] = useFormState<CampaignActionResult | null, FormData>(
    createCampaignDraftAction,
    null
  );

  return (
    <Card className="shadow-sm border-muted">
      <CardHeader>
        <CardTitle className="text-lg font-bold">Campaign Identity</CardTitle>
        <CardDescription>
          Each campaign represents one focused business offering or promotional topic.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {state?.error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <form action={formAction} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">
              Campaign Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              type="text"
              required
              placeholder="e.g. Gachibowli 3BHK Project"
            />
            {state?.fieldErrors?.name && (
              <p className="text-xs text-destructive">{state.fieldErrors.name}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="offeringType">
                Offering / Product Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="offeringType"
                name="offeringType"
                type="text"
                required
                placeholder="e.g. Luxury 3BHK Gated Apartments"
              />
              {state?.fieldErrors?.offeringType && (
                <p className="text-xs text-destructive">{state.fieldErrors.offeringType}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">
                Industry / Domain <span className="text-destructive">*</span>
              </Label>
              <select
                id="industry"
                name="industry"
                defaultValue="Real Estate"
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {CAMPAIGN_INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind} className="bg-card text-foreground">
                    {ind}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="objective">
              Campaign Objective <span className="text-destructive">*</span>
            </Label>
            <select
              id="objective"
              name="objective"
              defaultValue="Qualify prospects"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {CAMPAIGN_OBJECTIVES.map((obj) => (
                <option key={obj} value={obj} className="bg-card text-foreground">
                  {obj}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              Short Description / Pitch <span className="text-destructive">*</span>
            </Label>
            <textarea
              id="description"
              name="description"
              rows={3}
              required
              placeholder="Brief summary of the offering and what customer conversation should achieve..."
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            {state?.fieldErrors?.description && (
              <p className="text-xs text-destructive">{state.fieldErrors.description}</p>
            )}
          </div>

          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>
              Saving this step initiates a new DRAFT campaign version. You can pause and resume editing anytime.
            </span>
          </div>

          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
