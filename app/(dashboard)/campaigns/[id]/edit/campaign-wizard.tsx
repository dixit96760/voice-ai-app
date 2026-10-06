"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Campaign, CampaignSource } from "@/lib/campaign/types";
import {
  updateCampaignBasicInfoAction,
  addKnowledgeSourceAction,
  removeKnowledgeSourceAction,
  updateAiBehaviorAction,
  assignContactsToCampaignAction,
  removeContactFromCampaignAction,
  updateCallingRulesAction,
  validateAndMarkReadyAction,
} from "@/lib/campaign/actions";
import {
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_INDUSTRIES,
  SUPPORTED_LANGUAGES,
  CampaignReadinessResult,
} from "@/lib/validation/campaign";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CheckCircle2,
  AlertCircle,
  FileText,
  Trash2,
  Plus,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Calendar,
  Users,
  Settings2,
  BookOpen,
  Info,
} from "lucide-react";

interface WizardContactItem {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  city?: string | null;
  tags?: string[];
  status?: string;
  is_dnc?: boolean;
}

export interface WizardAssignedContact {
  id: string;
  contact_id?: string;
  status?: string;
  attempt_count?: number;
  contacts?: WizardContactItem;
}

interface AiConfig {
  language?: string;
  preferredLanguage?: string;
  additionalLanguages?: string[];
  tone?: string;
  salesAssistance?: string;
  behaviorRules?: {
    onlyApprovedInfo?: boolean;
    neverInventPrices?: boolean;
    redirectUnrelatedQuestions?: boolean;
    respectDnc?: boolean;
    captureCallback?: boolean;
    endAbusivePolitely?: boolean;
  };
}

interface CampaignWizardProps {
  campaign: Campaign;
  activeVersion: Record<string, unknown> | null;
  sources: CampaignSource[];
  assignedContacts: WizardAssignedContact[];
  businessContacts: WizardContactItem[];
  initialStep: number;
}

const STEPS = [
  { step: 1, title: "Basic Info", icon: Info },
  { step: 2, title: "Knowledge", icon: BookOpen },
  { step: 3, title: "AI Behavior", icon: Settings2 },
  { step: 4, title: "Audience", icon: Users },
  { step: 5, title: "Calling Rules", icon: Calendar },
  { step: 6, title: "Review & Ready", icon: ShieldCheck },
];

export default function CampaignWizard({
  campaign,
  activeVersion,
  sources,
  assignedContacts,
  businessContacts,
  initialStep,
}: CampaignWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [readinessResult, setReadinessResult] = useState<CampaignReadinessResult | null>(null);

  // Contacts step state
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  // Step 2: Add Source state
  const [newSource, setNewSource] = useState<{
    name: string;
    type: "manual" | "website" | "document" | "faq";
    rawText: string;
    url: string;
  }>({
    name: "",
    type: "manual",
    rawText: "",
    url: "",
  });

  const aiConfig: AiConfig = (activeVersion?.configuration as AiConfig) || {
    language: "en-IN",
    tone: "Friendly",
    salesAssistance: "Mild",
    behaviorRules: {
      onlyApprovedInfo: true,
      neverInventPrices: true,
      redirectUnrelatedQuestions: true,
      respectDnc: true,
      captureCallback: true,
      endAbusivePolitely: true,
    },
  };

  const handleStepChange = (newStep: number) => {
    setErrorMsg("");
    setSuccessMsg("");
    setStep(newStep);
  };

  // Step 1 Submit
  const handleSaveBasicInfo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    const formData = new FormData(e.currentTarget);
    try {
      const res = await updateCampaignBasicInfoAction(campaign.id, null, formData);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg("Basic info saved.");
        handleStepChange(2);
      }
    } catch {
      setErrorMsg("Failed to save basic info.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2 Add Source
  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSource.name || (newSource.type === "manual" && !newSource.rawText)) {
      setErrorMsg("Please provide source title and knowledge text.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    const formData = new FormData();
    formData.set("sourceType", newSource.type);
    formData.set("sourceName", newSource.name);
    formData.set("rawText", newSource.rawText);
    formData.set("sourceUrl", newSource.url);

    try {
      const res = await addKnowledgeSourceAction(campaign.id, null, formData);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg("Knowledge source attached.");
        setNewSource({ name: "", type: "manual", rawText: "", url: "" });
        router.refresh();
      }
    } catch {
      setErrorMsg("Failed to add source.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2 Remove Source
  const handleRemoveSource = async (sourceId: string) => {
    setLoading(true);
    try {
      const res = await removeKnowledgeSourceAction(campaign.id, sourceId);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        router.refresh();
      }
    } catch {
      setErrorMsg("Failed to delete source.");
    } finally {
      setLoading(false);
    }
  };

  // Step 3 Submit AI Behavior
  const handleSaveAiBehavior = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    const formData = new FormData(e.currentTarget);
    try {
      const res = await updateAiBehaviorAction(campaign.id, null, formData);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg("AI behavior configuration saved.");
        handleStepChange(4);
      }
    } catch {
      setErrorMsg("Failed to save AI behavior.");
    } finally {
      setLoading(false);
    }
  };

  // Step 4 Assign Contacts
  const handleAssignSelectedContacts = async () => {
    if (selectedContactIds.length === 0) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await assignContactsToCampaignAction(campaign.id, selectedContactIds);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(res.message || "Contacts assigned.");
        setSelectedContactIds([]);
        router.refresh();
      }
    } catch {
      setErrorMsg("Failed to assign contacts.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveContact = async (contactId: string) => {
    setLoading(true);
    try {
      const res = await removeContactFromCampaignAction(campaign.id, contactId);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        router.refresh();
      }
    } catch {
      setErrorMsg("Failed to remove contact.");
    } finally {
      setLoading(false);
    }
  };

  // Step 5 Save Calling Rules
  const handleSaveCallingRules = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    const formData = new FormData(e.currentTarget);
    try {
      const res = await updateCallingRulesAction(campaign.id, null, formData);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg("Calling rules saved.");
        handleStepChange(6);
      }
    } catch {
      setErrorMsg("Failed to save calling rules.");
    } finally {
      setLoading(false);
    }
  };

  // Step 6 Validate & Mark Ready
  const handleValidateAndMarkReady = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await validateAndMarkReadyAction(campaign.id);
      if (res.data) {
        setReadinessResult(res.data);
      }
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg("Campaign successfully validated and marked as READY!");
        router.refresh();
      }
    } catch {
      setErrorMsg("Validation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Bar / Steps Header */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 border-b pb-4">
        {STEPS.map((s) => {
          const Icon = s.icon;
          const isActive = step === s.step;
          const isPassed = step > s.step;
          return (
            <button
              key={s.step}
              type="button"
              onClick={() => handleStepChange(s.step)}
              className={`flex items-center gap-2 p-2 rounded-lg text-xs font-semibold transition-all text-left ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : isPassed
                  ? "bg-muted text-foreground hover:bg-muted/80"
                  : "text-muted-foreground hover:bg-muted/40"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <div className="truncate">
                <span className="block text-[10px] uppercase tracking-wider opacity-80">
                  Step {s.step}
                </span>
                <span className="truncate">{s.title}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Global Alerts */}
      {errorMsg && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {successMsg && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{successMsg}</AlertDescription>
        </Alert>
      )}

      {/* STEP 1: Basic Information */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold">1. Basic Information</CardTitle>
            <CardDescription>
              Identify what this campaign is about and its primary conversion objective.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form id="basic-info-form" onSubmit={handleSaveBasicInfo} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name *</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={campaign.name}
                  required
                  placeholder="e.g. Gachibowli 3BHK Project"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="offeringType">Offering / Product *</Label>
                  <Input
                    id="offeringType"
                    name="offeringType"
                    defaultValue={campaign.offering_type || ""}
                    required
                    placeholder="e.g. 3BHK Luxury Apartments"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industry">Industry *</Label>
                  <select
                    id="industry"
                    name="industry"
                    defaultValue={campaign.industry || "Real Estate"}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                <Label htmlFor="objective">Objective *</Label>
                <select
                  id="objective"
                  name="objective"
                  defaultValue={campaign.objective || "Qualify prospects"}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {CAMPAIGN_OBJECTIVES.map((obj) => (
                    <option key={obj} value={obj} className="bg-card text-foreground">
                      {obj}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Short Description *</Label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  defaultValue={campaign.description || ""}
                  required
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save & Next: Knowledge
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Campaign Knowledge */}
      {step === 2 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold">2. Campaign Knowledge</CardTitle>
              <CardDescription>
                Provide approved project details, pricing, features, and FAQs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Important safety alert */}
              <Alert variant="warning">
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>Strict Factuality Warning</AlertTitle>
                <AlertDescription>
                  The AI voice agent will strictly answer questions based only on approved campaign
                  knowledge. It will never invent non-approved discounts or imaginary prices.
                </AlertDescription>
              </Alert>

              {/* List existing sources */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Attached Knowledge Sources</h3>
                {sources.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No sources attached yet. Add manual text or document details below.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {sources.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-lg border p-3 text-sm"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            <span className="font-semibold">{s.source_name}</span>
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {s.source_type}
                            </Badge>
                            <Badge
                              variant={s.processing_status === "READY" ? "success" : "secondary"}
                              className="text-[10px]"
                            >
                              {s.processing_status}
                            </Badge>
                          </div>
                          {s.raw_text && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {s.raw_text}
                            </p>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveSource(s.id)}
                          disabled={loading}
                          className="h-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Knowledge Source Form */}
              <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" />
                  Add New Approved Knowledge
                </h4>

                <form onSubmit={handleAddSource} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sourceName">Source Title *</Label>
                      <Input
                        id="sourceName"
                        value={newSource.name}
                        onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                        placeholder="e.g. 3BHK Price List & Amenities"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sourceType">Source Type</Label>
                      <select
                        id="sourceType"
                        value={newSource.type}
                        onChange={(e) =>
                          setNewSource({
                            ...newSource,
                            type: e.target.value as "manual" | "website" | "document" | "faq",
                          })
                        }
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="manual" className="bg-card text-foreground">
                          Manual Text Entry
                        </option>
                        <option value="website" className="bg-card text-foreground">
                          Website URL Reference
                        </option>
                        <option value="pdf" className="bg-card text-foreground">
                          PDF Document
                        </option>
                        <option value="document" className="bg-card text-foreground">
                          Brochure / Doc
                        </option>
                      </select>
                    </div>
                  </div>

                  {newSource.type === "website" ? (
                    <div className="space-y-2">
                      <Label htmlFor="sourceUrl">Website URL</Label>
                      <Input
                        id="sourceUrl"
                        type="url"
                        value={newSource.url}
                        onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                        placeholder="https://example.com/project-details"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="rawText">
                        Approved Information / FAQs (Pricing, Specifications, Terms) *
                      </Label>
                      <textarea
                        id="rawText"
                        rows={4}
                        value={newSource.rawText}
                        onChange={(e) => setNewSource({ ...newSource, rawText: e.target.value })}
                        placeholder="Enter approved details, pricing (e.g. Starts at 1.35 Cr), clubhouse amenities, possession date, site visit hours..."
                        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                  )}

                  <Button type="submit" disabled={loading} size="sm">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Attach Knowledge Source
                  </Button>
                </form>
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <Button variant="outline" type="button" onClick={() => handleStepChange(1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back: Basic Info
                </Button>
                <Button type="button" onClick={() => handleStepChange(3)}>
                  Next: AI Behavior
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* STEP 3: AI Behavior */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold">3. AI Voice Behavior</CardTitle>
            <CardDescription>
              Configure language preferences, tone, and conversation safety guidelines.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveAiBehavior} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="preferredLanguage">Preferred Language *</Label>
                  <select
                    id="preferredLanguage"
                    name="preferredLanguage"
                    defaultValue={aiConfig.language || "en-IN"}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code} className="bg-card text-foreground">
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tone">Conversation Tone *</Label>
                  <select
                    id="tone"
                    name="tone"
                    defaultValue={aiConfig.tone || "Friendly"}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="Professional" className="bg-card text-foreground">
                      Professional
                    </option>
                    <option value="Friendly" className="bg-card text-foreground">
                      Friendly (Recommended)
                    </option>
                    <option value="Conversational" className="bg-card text-foreground">
                      Conversational
                    </option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="salesAssistance">Sales Assistance Level *</Label>
                  <select
                    id="salesAssistance"
                    name="salesAssistance"
                    defaultValue={aiConfig.salesAssistance || "Mild"}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="Off" className="bg-card text-foreground">
                      Off (Information only)
                    </option>
                    <option value="Mild" className="bg-card text-foreground">
                      Mild (Gentle recommendation)
                    </option>
                    <option value="Moderate" className="bg-card text-foreground">
                      Moderate (Proactive scheduling)
                    </option>
                  </select>
                </div>
              </div>

              {/* Behavior Safety Rules */}
              <div className="border-t pt-4 space-y-3">
                <h4 className="text-sm font-semibold text-foreground">
                  Safety & Guardrail Rules
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label className="flex items-center gap-2 p-2 border rounded-md bg-muted/20">
                    <input
                      type="checkbox"
                      name="onlyApprovedInfo"
                      defaultChecked={aiConfig.behaviorRules?.onlyApprovedInfo !== false}
                      className="rounded text-primary"
                    />
                    <span>Only use approved campaign knowledge</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 border rounded-md bg-muted/20">
                    <input
                      type="checkbox"
                      name="neverInventPrices"
                      defaultChecked={aiConfig.behaviorRules?.neverInventPrices !== false}
                      className="rounded text-primary"
                    />
                    <span>Never hallucinate pricing or discounts</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 border rounded-md bg-muted/20">
                    <input
                      type="checkbox"
                      name="redirectUnrelatedQuestions"
                      defaultChecked={aiConfig.behaviorRules?.redirectUnrelatedQuestions !== false}
                      className="rounded text-primary"
                    />
                    <span>Politely redirect unrelated questions</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 border rounded-md bg-muted/20">
                    <input
                      type="checkbox"
                      name="respectDnc"
                      defaultChecked={aiConfig.behaviorRules?.respectDnc !== false}
                      className="rounded text-primary"
                    />
                    <span>Respect Do Not Call (DNC) requests</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 border rounded-md bg-muted/20">
                    <input
                      type="checkbox"
                      name="captureCallback"
                      defaultChecked={aiConfig.behaviorRules?.captureCallback !== false}
                      className="rounded text-primary"
                    />
                    <span>Capture customer-requested callback time</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 border rounded-md bg-muted/20">
                    <input
                      type="checkbox"
                      name="endAbusivePolitely"
                      defaultChecked={aiConfig.behaviorRules?.endAbusivePolitely !== false}
                      className="rounded text-primary"
                    />
                    <span>End abusive conversations politely</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <Button variant="outline" type="button" onClick={() => handleStepChange(2)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back: Knowledge
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save & Next: Contacts
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: Contacts Assignment */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold">4. Assign Contacts</CardTitle>
            <CardDescription>
              Select verified customer contacts to associate with this calling campaign.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Already Assigned Table */}
            <div>
              <div className="flex items-center justify-between pb-2">
                <h4 className="text-sm font-semibold">
                  Assigned Campaign Contacts ({assignedContacts.length})
                </h4>
              </div>

              {assignedContacts.length === 0 ? (
                <div className="p-4 border border-dashed rounded-lg text-center text-xs text-muted-foreground">
                  No contacts assigned to this campaign yet. Select from your business contacts below.
                </div>
              ) : (
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b bg-muted/40">
                      <tr>
                        <th className="p-2 text-left">Name</th>
                        <th className="p-2 text-left">Phone</th>
                        <th className="p-2 text-left">City</th>
                        <th className="p-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignedContacts.map((ac) => (
                        <tr key={ac.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="p-2 font-medium">{ac.contacts?.name}</td>
                          <td className="p-2 text-muted-foreground">{ac.contacts?.phone}</td>
                          <td className="p-2">{ac.contacts?.city || "—"}</td>
                          <td className="p-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveContact(ac.contact_id || ac.id)}
                              className="text-destructive hover:underline"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Business Contacts Selection */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold">Available Business Contacts</h4>
                  <p className="text-xs text-muted-foreground">
                    Non-DNC contacts ready for assignment
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleAssignSelectedContacts}
                  disabled={loading || selectedContactIds.length === 0}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Assign Selected ({selectedContactIds.length})
                </Button>
              </div>

              {businessContacts.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No contacts found in your business directory.
                </p>
              ) : (
                <div className="border rounded-lg max-h-56 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b bg-muted/40 sticky top-0">
                      <tr>
                        <th className="p-2 text-left w-8">
                          <input
                            type="checkbox"
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedContactIds(businessContacts.map((c) => c.id));
                              } else {
                                setSelectedContactIds([]);
                              }
                            }}
                          />
                        </th>
                        <th className="p-2 text-left">Name</th>
                        <th className="p-2 text-left">Phone</th>
                        <th className="p-2 text-left">City</th>
                      </tr>
                    </thead>
                    <tbody>
                      {businessContacts.map((c) => {
                        const isSelected = selectedContactIds.includes(c.id);
                        return (
                          <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="p-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedContactIds([...selectedContactIds, c.id]);
                                  } else {
                                    setSelectedContactIds(
                                      selectedContactIds.filter((id) => id !== c.id)
                                    );
                                  }
                                }}
                              />
                            </td>
                            <td className="p-2 font-medium">{c.name}</td>
                            <td className="p-2 text-muted-foreground">{c.phone}</td>
                            <td className="p-2">{c.city || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <Button variant="outline" type="button" onClick={() => handleStepChange(3)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back: AI Behavior
              </Button>
              <Button type="button" onClick={() => handleStepChange(5)}>
                Next: Calling Rules
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 5: Calling Rules */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold">5. Calling Rules & Schedule</CardTitle>
            <CardDescription>
              Configure allowable hours, Indian timezone, retry spacing, and attempt limits.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveCallingRules} className="space-y-6">
              {/* Calling Days */}
              <div className="space-y-2">
                <Label>Allowed Calling Days *</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { day: 1, label: "Mon" },
                    { day: 2, label: "Tue" },
                    { day: 3, label: "Wed" },
                    { day: 4, label: "Thu" },
                    { day: 5, label: "Fri" },
                    { day: 6, label: "Sat" },
                    { day: 7, label: "Sun" },
                  ].map((d) => {
                    const isChecked = (campaign.calling_days || [1, 2, 3, 4, 5, 6]).includes(
                      d.day
                    );
                    return (
                      <label
                        key={d.day}
                        className="flex items-center gap-1.5 p-2 border rounded-md text-xs cursor-pointer hover:bg-muted/40"
                      >
                        <input
                          type="checkbox"
                          name="callingDays"
                          value={d.day}
                          defaultChecked={isChecked}
                          className="rounded text-primary"
                        />
                        <span>{d.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Hours & Timezone */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="callingStartTime">Start Time *</Label>
                  <Input
                    id="callingStartTime"
                    name="callingStartTime"
                    type="time"
                    defaultValue={campaign.calling_start_time?.slice(0, 5) || "10:00"}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="callingEndTime">End Time *</Label>
                  <Input
                    id="callingEndTime"
                    name="callingEndTime"
                    type="time"
                    defaultValue={campaign.calling_end_time?.slice(0, 5) || "18:30"}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone *</Label>
                  <Input
                    id="timezone"
                    name="timezone"
                    defaultValue={campaign.timezone || "Asia/Kolkata"}
                    required
                    readOnly
                    className="bg-muted text-muted-foreground"
                  />
                </div>
              </div>

              {/* Attempts & Spacing */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxAttempts">Max Attempts / Contact *</Label>
                  <Input
                    id="maxAttempts"
                    name="maxAttempts"
                    type="number"
                    min={1}
                    max={10}
                    defaultValue={campaign.max_attempts || 3}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retryIntervalMinutes">Retry Gap (Minutes) *</Label>
                  <Input
                    id="retryIntervalMinutes"
                    name="retryIntervalMinutes"
                    type="number"
                    min={15}
                    max={1440}
                    defaultValue={campaign.retry_interval_minutes || 60}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxCallDurationSeconds">Max Duration (Seconds) *</Label>
                  <Input
                    id="maxCallDurationSeconds"
                    name="maxCallDurationSeconds"
                    type="number"
                    min={30}
                    max={1800}
                    defaultValue={campaign.max_call_duration_seconds || 300}
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <Button variant="outline" type="button" onClick={() => handleStepChange(4)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back: Contacts
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save & Next: Review
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* STEP 6: Review & Readiness */}
      {step === 6 && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold">6. Review & Campaign Readiness</CardTitle>
                <CardDescription>
                  Audit all campaign components before promoting to READY state.
                </CardDescription>
              </div>
              <Badge variant={campaign.status === "READY" ? "success" : "secondary"}>
                Status: {campaign.status}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Readiness Error List */}
              {readinessResult && !readinessResult.ready && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Campaign is not ready yet</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-2 list-disc pl-4 space-y-1 text-xs">
                      {readinessResult.errors.map((err, idx) => (
                        <li key={idx}>
                          <strong className="uppercase">[{err.section}]</strong> {err.message}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Basic Info Summary */}
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">
                      Basic Information
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStepChange(1)}
                      className="text-xs h-6 px-2 text-primary"
                    >
                      Edit
                    </Button>
                  </div>
                  <p className="font-bold text-base">{campaign.name}</p>
                  <p className="text-xs text-muted-foreground">Offering: {campaign.offering_type}</p>
                  <p className="text-xs text-muted-foreground">Objective: {campaign.objective}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {campaign.description}
                  </p>
                </div>

                {/* Knowledge Summary */}
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">
                      Knowledge Sources
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStepChange(2)}
                      className="text-xs h-6 px-2 text-primary"
                    >
                      Edit
                    </Button>
                  </div>
                  <p className="font-bold text-base">{sources.length} Source(s) Attached</p>
                  {sources.length > 0 ? (
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {sources.map((s) => (
                        <li key={s.id} className="flex items-center gap-2">
                          <span>• {s.source_name}</span>
                          <Badge variant="outline" className="text-[9px]">
                            {s.processing_status}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-destructive">No approved knowledge attached.</p>
                  )}
                </div>

                {/* AI Voice Behavior Summary */}
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">
                      AI Behavior
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStepChange(3)}
                      className="text-xs h-6 px-2 text-primary"
                    >
                      Edit
                    </Button>
                  </div>
                  <p className="font-bold text-base">Language: {aiConfig.language || "en-IN"}</p>
                  <p className="text-xs text-muted-foreground">Tone: {aiConfig.tone || "Friendly"}</p>
                  <p className="text-xs text-muted-foreground">
                    Sales Assistance: {aiConfig.salesAssistance || "Mild"}
                  </p>
                </div>

                {/* Calling Rules & Audience */}
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">
                      Audience & Schedule
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStepChange(4)}
                      className="text-xs h-6 px-2 text-primary"
                    >
                      Edit
                    </Button>
                  </div>
                  <p className="font-bold text-base">{assignedContacts.length} Assigned Contacts</p>
                  <p className="text-xs text-muted-foreground">
                    Calling Window: {campaign.calling_start_time?.slice(0, 5)} -{" "}
                    {campaign.calling_end_time?.slice(0, 5)} ({campaign.timezone})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Max Attempts: {campaign.max_attempts} | Retry: {campaign.retry_interval_minutes}m
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="border-t pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <Button variant="outline" type="button" onClick={() => handleStepChange(5)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back: Calling Rules
                </Button>

                <div className="flex items-center gap-3">
                  <Button variant="outline" asChild>
                    <Link href={`/campaigns/${campaign.id}`}>Exit to Overview</Link>
                  </Button>

                  <Button
                    onClick={handleValidateAndMarkReady}
                    disabled={loading}
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 mr-2" />
                    )}
                    Validate & Mark READY
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
