import { z } from "zod";
import { normalizeIndianPhone } from "./phone";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password must not exceed 128 characters");

export const signUpSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters")
      .max(80, "Full name must be under 80 characters"),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Please enter a valid work email address"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const resetPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address"),
});

export const phoneOtpRequestSchema = z.object({
  phone: z.string().transform((val, ctx) => {
    const res = normalizeIndianPhone(val);
    if (!res.isValid || !res.normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: res.errorMessage || "Invalid Indian mobile number (+91XXXXXXXXXX)",
      });
      return z.NEVER;
    }
    return res.normalized;
  }),
});

export const phoneOtpVerifySchema = z.object({
  phone: z.string().transform((val, ctx) => {
    const res = normalizeIndianPhone(val);
    if (!res.isValid || !res.normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: res.errorMessage || "Invalid Indian mobile number",
      });
      return z.NEVER;
    }
    return res.normalized;
  }),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Verification code must be exactly 6 digits"),
});
