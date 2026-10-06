const BLOCKED_AUTH_PATHS = new Set([
  "/login",
  "/signup",
  "/reset-password",
  "/auth/callback",
  "/auth/verify",
]);

const ALLOWED_REDIRECT_PREFIXES = [
  "/dashboard",
  "/campaigns",
  "/contacts",
  "/calls",
  "/callbacks",
  "/analytics",
  "/usage",
  "/billing",
  "/settings",
  "/help",
  "/onboarding",
  "/update-password",
];

/**
 * Returns a same-origin application path or an empty string.
 * Rejects protocol-relative URLs, backslash variants, control characters,
 * and auth entry points that could create redirect loops.
 */
export function getSafeRedirectPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) return "";
  if (value.startsWith("//") || value.includes("\\")) return "";
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return "";

  try {
    const base = new URL("https://app.invalid");
    const parsed = new URL(value, base);
    if (parsed.origin !== base.origin) return "";
    if (BLOCKED_AUTH_PATHS.has(parsed.pathname)) return "";
    if (!ALLOWED_REDIRECT_PREFIXES.some((prefix) => parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`))) {
      return "";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "";
  }
}
