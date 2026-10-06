import { createClient } from "@/lib/supabase/server";

export const ALLOWED_LOGO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
];

export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export interface LogoValidationResult {
  valid: boolean;
  error?: string;
}

export function validateLogoFile(file: File): LogoValidationResult {
  if (!ALLOWED_LOGO_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "Invalid image format. Supported formats: JPEG, PNG, WebP, SVG.",
    };
  }

  if (file.size > MAX_LOGO_SIZE_BYTES) {
    return {
      valid: false,
      error: "File size exceeds 2 MB limit.",
    };
  }

  return { valid: true };
}

export async function uploadBusinessLogo(
  userId: string,
  file: File
): Promise<{ logoUrl: string | null; error?: string }> {
  const validation = validateLogoFile(file);
  if (!validation.valid) {
    return { logoUrl: null, error: validation.error };
  }

  const supabase = await createClient();
  const fileExt = file.name.split(".").pop() || "png";
  const sanitizedExt = fileExt.replace(/[^a-zA-Z0-9]/g, "");
  const fileName = `${userId}/logo_${Date.now()}.${sanitizedExt}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from("business-logos")
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return { logoUrl: null, error: uploadError.message };
  }

  // Get signed URL or path for the private bucket
  const { data: signedData, error: signError } = await supabase.storage
    .from("business-logos")
    .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year signed URL

  if (signError || !signedData) {
    return { logoUrl: null, error: signError?.message || "Failed to generate logo URL" };
  }

  return { logoUrl: signedData.signedUrl };
}
