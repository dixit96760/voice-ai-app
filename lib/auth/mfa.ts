import { createClient } from "@/lib/supabase/server";

/**
 * MFA is delegated to Supabase Auth's built-in TOTP and recovery-code APIs.
 * These wrappers keep the application boundary small and make it possible to
 * add SSO/WebAuthn factors later without changing authorization code.
 */
export async function getMfaAssuranceLevel() {
  const supabase = await createClient();
  return supabase.auth.mfa.getAuthenticatorAssuranceLevel();
}

export async function listMfaFactors() {
  const supabase = await createClient();
  return supabase.auth.mfa.listFactors();
}

export async function enrollTotp(friendlyName: string) {
  const supabase = await createClient();
  return supabase.auth.mfa.enroll({ factorType: "totp", friendlyName });
}

export async function challengeMfaFactor(factorId: string) {
  const supabase = await createClient();
  return supabase.auth.mfa.challenge({ factorId });
}

export async function verifyMfaFactor(
  factorId: string,
  challengeId: string,
  code: string
) {
  const supabase = await createClient();
  return supabase.auth.mfa.verify({ factorId, challengeId, code });
}

export async function unenrollMfaFactor(factorId: string) {
  const supabase = await createClient();
  return supabase.auth.mfa.unenroll({ factorId });
}

export async function generateMfaRecoveryCodes() {
  const supabase = await createClient();
  return supabase.auth.mfa.recoveryCodes.generate();
}
