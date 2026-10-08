const PLACEHOLDER_PATTERN = /placeholder|your-project|your-supabase|your-.*key/i;

export const AUTH_CONFIG_ERROR =
  "Authentication is not configured yet. Add a valid NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the app.";

function isValidSupabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    return (url.protocol === "https:" || isLocal) && !PLACEHOLDER_PATTERN.test(url.hostname);
  } catch {
    return false;
  }
}

export function getTrustedAppOrigin(): string | null {
  // On Vercel, fall back to the project's production domain so auth emails
  // never link to localhost when NEXT_PUBLIC_APP_URL is not set.
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");
  try {
    const url = new URL(configured);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol === "https:" || local) return url.origin;
  } catch {
    // Fall through to the safe local default in development.
  }
  return process.env.NODE_ENV === "production" ? null : "http://localhost:3000";
}

export function isSupabaseAuthConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";

  return (
    isValidSupabaseUrl(url) &&
    anonKey.length >= 20 &&
    !PLACEHOLDER_PATTERN.test(anonKey)
  );
}
