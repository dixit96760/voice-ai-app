import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

const KEY_PREFIX = "sv_live_";

function getPepper(): string {
  const pepper = process.env.AUTH_API_KEY_PEPPER || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!pepper) {
    throw new Error("AUTH_API_KEY_PEPPER or SUPABASE_SERVICE_ROLE_KEY is required for API keys.");
  }
  return pepper;
}

export function hashApiKey(rawKey: string): string {
  return createHmac("sha256", getPepper()).update(rawKey).digest("hex");
}

export function isApiKeyFormat(value: string): boolean {
  return value.startsWith(KEY_PREFIX) && value.includes(".");
}

export function createApiKeyMaterial(): {
  rawKey: string;
  keyPrefix: string;
  keyHash: string;
} {
  const id = randomUUID().replace(/-/g, "");
  const keyPrefix = `${KEY_PREFIX}${id.slice(0, 12)}`;
  const secret = randomBytes(32).toString("base64url");
  const rawKey = `${keyPrefix}.${secret}`;

  return {
    rawKey,
    keyPrefix,
    keyHash: hashApiKey(rawKey),
  };
}

export function verifyApiKey(rawKey: string, expectedHash: string): boolean {
  if (!isApiKeyFormat(rawKey)) return false;

  const actual = Buffer.from(hashApiKey(rawKey), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
