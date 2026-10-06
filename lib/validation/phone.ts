import { z } from "zod";

export type PhoneValidationStatus =
  | "VALID"
  | "INVALID"
  | "DUPLICATE"
  | "DNC"
  | "WRONG_NUMBER";

export interface PhoneValidationResult {
  isValid: boolean;
  rawInput: string;
  normalized: string | null;
  status: PhoneValidationStatus;
  errorMessage?: string;
}

/**
 * Normalizes Indian phone numbers into canonical E.164 representation (+91XXXXXXXXXX).
 * Handles:
 * - 10-digit mobile numbers: "9876543210" -> "+919876543210"
 * - Leading 0 (landline/trunk format): "09876543210" -> "+919876543210"
 * - With country code: "+919876543210" -> "+919876543210"
 * - Spaces, dashes, parentheses: "+91 98765-43210" -> "+919876543210"
 * Indian mobile numbers start with 6, 7, 8, or 9 and have exactly 10 digits.
 */
export function normalizeIndianPhone(input: string): PhoneValidationResult {
  const rawInput = input ? String(input).trim() : "";

  if (!rawInput) {
    return {
      isValid: false,
      rawInput,
      normalized: null,
      status: "INVALID",
      errorMessage: "Phone number is empty",
    };
  }

  // Strip all non-digit characters except leading +
  let cleaned = rawInput.replace(/[^\d+]/g, "");

  // If starts with +91, remove +91 for inspection
  if (cleaned.startsWith("+91")) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith("91") && cleaned.length === 12) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith("0") && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }

  // Cleaned must now be exactly 10 digits
  if (!/^\d{10}$/.test(cleaned)) {
    return {
      isValid: false,
      rawInput,
      normalized: null,
      status: "INVALID",
      errorMessage: "Phone number must be a 10-digit Indian mobile number",
    };
  }

  // Indian mobile numbers start with 6, 7, 8, or 9
  const firstDigit = cleaned.charAt(0);
  if (!["6", "7", "8", "9"].includes(firstDigit)) {
    return {
      isValid: false,
      rawInput,
      normalized: null,
      status: "INVALID",
      errorMessage: "Indian mobile numbers must begin with 6, 7, 8, or 9",
    };
  }

  const canonical = `+91${cleaned}`;

  return {
    isValid: true,
    rawInput,
    normalized: canonical,
    status: "VALID",
  };
}

export const indianPhoneSchema = z.string().transform((val, ctx) => {
  const result = normalizeIndianPhone(val);
  if (!result.isValid || !result.normalized) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: result.errorMessage || "Invalid Indian phone number format",
    });
    return z.NEVER;
  }
  return result.normalized;
});
