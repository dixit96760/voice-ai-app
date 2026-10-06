import { isSupabaseAuthConfigured } from "./config";

/**
 * Supabase exposes a public auth settings document that reports which sign-in
 * providers are enabled for the project. Reading it lets the app explain
 * "phone login is switched off" instead of showing a generic failure.
 *
 * GET {SUPABASE_URL}/auth/v1/settings
 *   { external: { email, phone, google, ... }, sms_provider, ... }
 */

export type AuthProviderName = "email" | "phone" | "google";

export interface AuthProviderAvailability {
  email: boolean;
  phone: boolean;
  google: boolean;
  smsProvider: string | null;
  /** "supabase" = live answer, "fallback" = could not be determined. */
  source: "supabase" | "fallback";
  checkedAt: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

let cached: { value: AuthProviderAvailability; expiresAt: number } | null = null;

/** Assume nothing is enabled when Supabase cannot be reached. */
function unavailable(): AuthProviderAvailability {
  return {
    email: false,
    phone: false,
    google: false,
    smsProvider: null,
    source: "fallback",
    checkedAt: new Date().toISOString(),
  };
}

/** Providers are assumed available when we cannot determine their state. */
function assumeAvailable(): AuthProviderAvailability {
  return {
    email: true,
    phone: true,
    google: true,
    smsProvider: null,
    source: "fallback",
    checkedAt: new Date().toISOString(),
  };
}

export function isProviderDisabledError(error: unknown): boolean {
  const code = String((error as { code?: unknown })?.code ?? "").toLowerCase();
  const message = String((error as { message?: unknown })?.message ?? "").toLowerCase();
  const rawCode = String(
    (error as { error_code?: unknown })?.error_code ?? ""
  ).toLowerCase();

  return (
    code.includes("provider_disabled") ||
    rawCode.includes("provider_disabled") ||
    message.includes("unsupported phone provider") ||
    message.includes("provider is not enabled") ||
    message.includes("provider not enabled") ||
    message.includes("signups not allowed for otp")
  );
}

export async function getAuthProviderAvailability(): Promise<AuthProviderAvailability> {
  if (!isSupabaseAuthConfigured()) {
    return unavailable();
  }

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  try {
    const response = await fetch(`${baseUrl}/auth/v1/settings`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      cache: "no-store",
    });

    if (!response.ok) {
      return assumeAvailable();
    }

    const settings = (await response.json()) as {
      external?: Record<string, boolean>;
      sms_provider?: string;
    };
    const external = settings.external || {};

    const value: AuthProviderAvailability = {
      email: external.email !== false,
      phone: external.phone === true,
      google: external.google === true,
      smsProvider: settings.sms_provider || null,
      source: "supabase",
      checkedAt: new Date().toISOString(),
    };

    cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  } catch {
    // Network hiccup: do not block sign-in on a failed capability probe.
    return assumeAvailable();
  }
}
