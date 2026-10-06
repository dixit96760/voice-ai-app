import { z } from "zod";

export const BUSINESS_TYPES = [
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

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const IANA_TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
  "UTC",
] as const;

export const businessOnboardingSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(2, "Business name must be at least 2 characters")
    .max(100, "Business name must be under 100 characters"),
  businessType: z.enum(BUSINESS_TYPES, {
    message: "Please select a valid business type",
  }),
  description: z
    .string()
    .trim()
    .max(500, "Description must be under 500 characters")
    .optional()
    .or(z.literal("")),
  website: z
    .string()
    .trim()
    .url("Please enter a valid website URL (e.g. https://example.com)")
    .optional()
    .or(z.literal("")),
  businessEmail: z
    .string()
    .trim()
    .email("Please enter a valid business email")
    .optional()
    .or(z.literal("")),
  businessPhone: z
    .string()
    .trim()
    .max(20, "Business phone is too long")
    .optional()
    .or(z.literal("")),
  address: z
    .string()
    .trim()
    .max(200, "Address must be under 200 characters")
    .optional()
    .or(z.literal("")),
  city: z
    .string()
    .trim()
    .max(100, "City must be under 100 characters")
    .optional()
    .or(z.literal("")),
  state: z
    .string()
    .trim()
    .max(100, "State must be under 100 characters")
    .optional()
    .or(z.literal("")),
  country: z
    .string()
    .trim()
    .min(2, "Country is required")
    .default("India"),
  timezone: z
    .string()
    .trim()
    .default("Asia/Kolkata")
    .refine(
      (tz) => {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      },
      { message: "Must be a valid IANA timezone identifier (e.g., Asia/Kolkata)" }
    ),
  logoUrl: z.string().url().optional().or(z.literal("")),
});

export type BusinessOnboardingInput = z.infer<typeof businessOnboardingSchema>;
