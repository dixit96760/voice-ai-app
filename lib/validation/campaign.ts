import { z } from "zod";

export const CAMPAIGN_OBJECTIVES = [
  "Generate leads",
  "Explain product",
  "Qualify prospects",
  "Promote an offer",
  "Follow up with customers",
  "Collect interest",
  "Schedule callbacks",
] as const;

export const CAMPAIGN_INDUSTRIES = [
  "Real Estate",
  "Education",
  "Healthcare",
  "Finance",
  "Insurance",
  "E-commerce",
  "Travel",
  "Automotive",
  "Professional Services",
  "Other",
] as const;

export const SUPPORTED_LANGUAGES = [
  { code: "en-IN", label: "Indian English" },
  { code: "hi-IN", label: "Hindi (हिंदी)" },
  { code: "te-IN", label: "Telugu (తెలుగు)" },
  { code: "ta-IN", label: "Tamil (தமிழ்)" },
  { code: "kn-IN", label: "Kannada (ಕನ್ನಡ)" },
  { code: "ml-IN", label: "Malayalam (മലയാളം)" },
  { code: "mr-IN", label: "Marathi (मराठी)" },
  { code: "bn-IN", label: "Bengali (বাংলা)" },
  { code: "gu-IN", label: "Gujarati (ગુજરાતી)" },
  { code: "pa-IN", label: "Punjabi (ਪੰਜਾਬੀ)" },
] as const;

export const campaignBasicInfoSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Campaign name must be at least 2 characters")
    .max(100, "Campaign name must be under 100 characters"),
  offeringType: z
    .string()
    .trim()
    .min(2, "Offering / product name must be at least 2 characters")
    .max(100, "Offering name must be under 100 characters"),
  industry: z
    .string()
    .trim()
    .min(2, "Please select or specify an industry")
    .default("Real Estate"),
  objective: z
    .string()
    .trim()
    .min(2, "Please select a campaign objective")
    .default("Qualify prospects"),
  description: z
    .string()
    .trim()
    .min(10, "Short description must be at least 10 characters")
    .max(1000, "Description must be under 1000 characters"),
});

export type CampaignBasicInfoInput = z.infer<typeof campaignBasicInfoSchema>;

export const campaignKnowledgeSourceSchema = z.object({
  sourceType: z.enum([
    "manual",
    "text",
    "pdf",
    "document",
    "website",
    "csv",
    "excel",
    "google_sheet",
  ]),
  sourceName: z
    .string()
    .trim()
    .min(2, "Source title must be at least 2 characters")
    .max(100, "Source title must be under 100 characters"),
  rawText: z
    .string()
    .trim()
    .min(10, "Knowledge text must be at least 10 characters")
    .max(20000, "Knowledge text exceeds limit")
    .optional()
    .or(z.literal("")),
  sourceUrl: z
    .string()
    .trim()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
});

export type CampaignKnowledgeSourceInput = z.infer<typeof campaignKnowledgeSourceSchema>;

export const campaignAiBehaviorSchema = z.object({
  preferredLanguage: z.string().default("en-IN"),
  additionalLanguages: z.array(z.string()).default([]),
  tone: z.enum(["Professional", "Friendly", "Conversational"]).default("Friendly"),
  salesAssistance: z.enum(["Off", "Mild", "Moderate"]).default("Mild"),
  behaviorRules: z
    .object({
      onlyApprovedInfo: z.boolean().default(true),
      neverInventPrices: z.boolean().default(true),
      redirectUnrelatedQuestions: z.boolean().default(true),
      respectDnc: z.boolean().default(true),
      captureCallback: z.boolean().default(true),
      endAbusivePolitely: z.boolean().default(true),
    })
    .default({
      onlyApprovedInfo: true,
      neverInventPrices: true,
      redirectUnrelatedQuestions: true,
      respectDnc: true,
      captureCallback: true,
      endAbusivePolitely: true,
    }),
});

export type CampaignAiBehaviorInput = z.infer<typeof campaignAiBehaviorSchema>;

export const campaignCallingRulesSchema = z
  .object({
    callingDays: z
      .array(z.number().int().min(1).max(7))
      .min(1, "Select at least one calling day"),
    callingStartTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Start time must be HH:MM (e.g. 10:00)"),
    callingEndTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "End time must be HH:MM (e.g. 18:30)"),
    timezone: z.string().default("Asia/Kolkata"),
    maxAttempts: z
      .number()
      .int()
      .min(1, "Attempts must be at least 1")
      .max(10, "Attempts must not exceed 10")
      .default(3),
    retryIntervalMinutes: z
      .number()
      .int()
      .min(15, "Retry gap must be at least 15 minutes")
      .max(1440, "Retry gap cannot exceed 24 hours")
      .default(60),
    maxCallDurationSeconds: z
      .number()
      .int()
      .min(30, "Duration must be at least 30 seconds")
      .max(1800, "Duration cannot exceed 30 minutes")
      .default(300),
  })
  .refine(
    (data) => {
      const [startH, startM] = data.callingStartTime.split(":").map(Number);
      const [endH, endM] = data.callingEndTime.split(":").map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      return endMinutes > startMinutes;
    },
    {
      message: "Calling end time must be after start time",
      path: ["callingEndTime"],
    }
  );

export type CampaignCallingRulesInput = z.infer<typeof campaignCallingRulesSchema>;

export interface CampaignValidationError {
  section: "basic" | "knowledge" | "ai" | "contacts" | "calling" | "ownership";
  code: string;
  message: string;
}

export interface CampaignReadinessResult {
  ready: boolean;
  errors: CampaignValidationError[];
}
