import type { BusinessDetailsMessage } from "./business-details";

/**
 * Meta WhatsApp Cloud API. Business-initiated messages must use a template
 * approved in WhatsApp Manager; see docs/whatsapp-setup.md for the template
 * this app expects (four body parameters, in BusinessDetailsMessage order).
 */
export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  templateName: string;
  templateLanguage: string;
  apiVersion: string;
}

export function getWhatsAppConfig(): WhatsAppConfig | null {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!accessToken || !phoneNumberId) return null;

  return {
    accessToken,
    phoneNumberId,
    templateName: process.env.WHATSAPP_TEMPLATE_NAME?.trim() || "business_details",
    templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "en",
    apiVersion: process.env.WHATSAPP_GRAPH_API_VERSION?.trim() || "v23.0",
  };
}

export type WhatsAppSendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; retryable: boolean };

/** Sends the business-details template to an E.164 number (+91...). */
export async function sendBusinessDetailsWhatsApp(
  config: WhatsAppConfig,
  toE164: string,
  message: BusinessDetailsMessage
): Promise<WhatsAppSendResult> {
  const to = toE164.replace(/\D/g, "");
  const response = await fetch(
    `https://graph.facebook.com/${config.apiVersion}/${encodeURIComponent(
      config.phoneNumberId
    )}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: config.templateName,
          language: { code: config.templateLanguage },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: message.customerName },
                { type: "text", text: message.businessName },
                { type: "text", text: message.details },
                { type: "text", text: message.contactInfo },
              ],
            },
          ],
        },
      }),
      signal: AbortSignal.timeout(10_000),
    }
  ).catch((err: unknown) => err as Error);

  if (response instanceof Error) {
    return { ok: false, error: `WhatsApp request failed: ${response.message}`, retryable: true };
  }

  const body = (await response.json().catch(() => ({}))) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string; code?: number };
  };

  if (!response.ok) {
    return {
      ok: false,
      error: `WhatsApp API ${response.status}: ${body.error?.message || "unknown error"}`,
      retryable: response.status >= 500 || response.status === 429,
    };
  }

  const messageId = body.messages?.[0]?.id;
  return messageId
    ? { ok: true, messageId }
    : { ok: false, error: "WhatsApp API returned no message id.", retryable: false };
}
