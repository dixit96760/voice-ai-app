import { z } from "zod";

/**
 * Optional string that treats an empty value (e.g. `KEY=` in .env.local) as
 * absent instead of failing schema validation.
 */
const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional()
);

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  AUTH_API_KEY_PEPPER: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().min(32).optional()
  ),
  SARVAM_API_KEY: optionalString,
  // Voice Agents key (Settings → API Key in indus.sarvam.ai). Preferred for
  // campaign/cohort calls; falls back to SARVAM_API_KEY.
  SARVAM_VOICE_AGENTS_API_KEY: optionalString,
  SARVAM_BASE_URL: z.string().url().default("https://apps.sarvam.ai"),
  // Voice Agents scheduling scope (org + workspace)
  SARVAM_ORG_ID: optionalString,
  SARVAM_WORKSPACE_ID: optionalString,
  // Default agent + telephony connection
  SARVAM_AGENT_APP_ID: optionalString,
  SARVAM_AGENT_APP_VERSION: optionalString,
  SARVAM_CONNECTION_ID: optionalString,
  // Dialing behaviour
  SARVAM_ATTEMPTS_PER_SECOND: optionalString,
  SARVAM_CAMPAIGN_TTL_DAYS: optionalString,
  SARVAM_COHORT_VARIABLES: optionalString,
  // Webhook verification / placement
  SARVAM_WEBHOOK_SECRET: optionalString,
  SARVAM_WEBHOOK_TOKEN: optionalString,
  SARVAM_WEBHOOK_CONFIG_IN_APP_CONFIG: optionalString,
  SARVAM_MOCK_MODE: z.string().default("false"),
  RAZORPAY_KEY_ID: optionalString,
  RAZORPAY_KEY_SECRET: optionalString,
  RAZORPAY_WEBHOOK_SECRET: optionalString,
  RAZORPAY_MOCK_MODE: z.string().default("true"),
  PLATFORM_STATE_CODE: z.string().default("27"),
  DEFAULT_GST_RATE: z.string().default("18.0"),
});

const rawEnv = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  AUTH_API_KEY_PEPPER: process.env.AUTH_API_KEY_PEPPER,
  SARVAM_API_KEY: process.env.SARVAM_API_KEY,
  SARVAM_VOICE_AGENTS_API_KEY: process.env.SARVAM_VOICE_AGENTS_API_KEY,
  SARVAM_BASE_URL: process.env.SARVAM_BASE_URL || "https://apps.sarvam.ai",
  SARVAM_ORG_ID: process.env.SARVAM_ORG_ID,
  SARVAM_WORKSPACE_ID: process.env.SARVAM_WORKSPACE_ID,
  SARVAM_AGENT_APP_ID: process.env.SARVAM_AGENT_APP_ID,
  SARVAM_AGENT_APP_VERSION: process.env.SARVAM_AGENT_APP_VERSION,
  SARVAM_CONNECTION_ID: process.env.SARVAM_CONNECTION_ID,
  SARVAM_ATTEMPTS_PER_SECOND: process.env.SARVAM_ATTEMPTS_PER_SECOND,
  SARVAM_CAMPAIGN_TTL_DAYS: process.env.SARVAM_CAMPAIGN_TTL_DAYS,
  SARVAM_COHORT_VARIABLES: process.env.SARVAM_COHORT_VARIABLES,
  SARVAM_WEBHOOK_SECRET: process.env.SARVAM_WEBHOOK_SECRET,
  SARVAM_WEBHOOK_TOKEN: process.env.SARVAM_WEBHOOK_TOKEN,
  SARVAM_WEBHOOK_CONFIG_IN_APP_CONFIG: process.env.SARVAM_WEBHOOK_CONFIG_IN_APP_CONFIG,
  SARVAM_MOCK_MODE: process.env.SARVAM_MOCK_MODE || "false",
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
  RAZORPAY_MOCK_MODE: process.env.RAZORPAY_MOCK_MODE || "true",
  PLATFORM_STATE_CODE: process.env.PLATFORM_STATE_CODE || "27",
  DEFAULT_GST_RATE: process.env.DEFAULT_GST_RATE || "18.0",
};

function getEnv() {
  const parsed = envSchema.safeParse(rawEnv);

  if (!parsed.success) {
    console.error("❌ Invalid environment variables:", parsed.error.format());
    // In test / build environments with dummy values, fall back gracefully
    return {
      ...rawEnv,
      NEXT_PUBLIC_APP_URL:
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key",
    };
  }

  return parsed.data;
}

export const env = getEnv();
