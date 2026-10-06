import { createAdminClient } from "@/lib/supabase/admin";
import { assertRateLimit } from "@/lib/security/rate-limiter";
import {
  createApiKeyMaterial,
  isApiKeyFormat,
  verifyApiKey,
} from "@/lib/auth/api-key";

export interface ApiKeyPrincipal {
  keyId: string;
  organizationId: string;
  createdBy: string;
  scopes: string[];
}

function readPresentedKey(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }
  return request.headers.get("x-api-key")?.trim() || null;
}

export async function authenticateApiKeyRequest(
  request: Request
): Promise<ApiKeyPrincipal | null> {
  const rawKey = readPresentedKey(request);
  if (!rawKey || !isApiKeyFormat(rawKey)) return null;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = await assertRateLimit(`auth:api-key:${ip}`, 60, 1);
  if (!rate.allowed) return null;

  const keyPrefix = rawKey.slice(0, rawKey.indexOf("."));
  const admin = createAdminClient();
  const { data: record, error } = await admin
    .from("api_keys")
    .select("id, organization_id, created_by, key_hash, scopes, status, expires_at, revoked_at")
    .eq("key_prefix", keyPrefix)
    .maybeSingle();

  if (error || !record || record.status !== "ACTIVE" || record.revoked_at) return null;
  if (record.expires_at && new Date(record.expires_at).getTime() <= Date.now()) return null;
  if (!verifyApiKey(rawKey, record.key_hash)) return null;

  await admin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", record.id);

  return {
    keyId: record.id,
    organizationId: record.organization_id,
    createdBy: record.created_by,
    scopes: record.scopes || [],
  };
}

export function hasApiKeyScope(
  principal: ApiKeyPrincipal,
  scope: string
): boolean {
  return principal.scopes.includes("*") || principal.scopes.includes(scope);
}

export async function issueApiKey(input: {
  organizationId: string;
  createdBy: string;
  name: string;
  scopes: string[];
  expiresAt?: string | null;
}) {
  const material = createApiKeyMaterial();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("api_keys")
    .insert({
      organization_id: input.organizationId,
      created_by: input.createdBy,
      name: input.name,
      key_prefix: material.keyPrefix,
      key_hash: material.keyHash,
      scopes: input.scopes,
      expires_at: input.expiresAt || null,
    })
    .select("id, name, key_prefix, scopes, expires_at, created_at")
    .single();

  if (error) throw error;
  return { record: data, rawKey: material.rawKey };
}
