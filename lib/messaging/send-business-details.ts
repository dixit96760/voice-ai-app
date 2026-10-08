import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeIndianPhone } from "@/lib/validation/phone";
import { buildBusinessDetailsMessage } from "./business-details";
import { getWhatsAppConfig, sendBusinessDetailsWhatsApp } from "./whatsapp";

type AdminClient = ReturnType<typeof createAdminClient>;

export type SendDetailsStatus =
  | "sent"
  | "already_sent"
  | "not_configured"
  | "failed"
  | "skipped";

export interface SendDetailsResult {
  status: SendDetailsStatus;
  /** What the voice agent should tell the customer. */
  agentMessage: string;
}

const RESEND_WINDOW_MS = 24 * 60 * 60 * 1000;

const AGENT_MESSAGES: Record<SendDetailsStatus, string> = {
  sent: "I have sent the details to you on WhatsApp on this number.",
  already_sent: "I have already sent the details to you on WhatsApp on this number.",
  not_configured: "Our team will share the details with you shortly.",
  failed: "Our team will share the details with you shortly.",
  skipped: "Our team will share the details with you shortly.",
};

/**
 * Sends the business and offer details to a contact on WhatsApp. Called by the
 * voice agent mid-call when the customer asks for details. The recipient is
 * always the contact's number on record, never a number from the request.
 */
export async function sendBusinessDetails(
  params: { contactId: string; campaignId: string; interactionId?: string | null },
  client?: AdminClient
): Promise<SendDetailsResult> {
  const supabase = client ?? createAdminClient();
  const result = (status: SendDetailsStatus): SendDetailsResult => ({
    status,
    agentMessage: AGENT_MESSAGES[status],
  });

  const [{ data: contact }, { data: campaign }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, business_id, name, phone, is_dnc")
      .eq("id", params.contactId)
      .maybeSingle(),
    supabase
      .from("campaigns")
      .select("id, business_id, offering_type, description")
      .eq("id", params.campaignId)
      .maybeSingle(),
  ]);

  // Both must exist and belong to the same business.
  if (!contact || !campaign || contact.business_id !== campaign.business_id) {
    return result("skipped");
  }

  const phone = normalizeIndianPhone(contact.phone);
  const log = (
    status: "sent" | "failed" | "not_configured" | "skipped",
    extra: { provider_message_id?: string; error?: string } = {}
  ) =>
    supabase.from("message_logs").insert({
      business_id: contact.business_id,
      campaign_id: campaign.id,
      contact_id: contact.id,
      channel: "whatsapp",
      purpose: "business_details",
      recipient: (phone.isValid && phone.normalized) || contact.phone,
      status,
      provider_interaction_id: params.interactionId || null,
      ...extra,
    });

  if (contact.is_dnc || !phone.isValid || !phone.normalized) {
    await log("skipped", { error: contact.is_dnc ? "Contact is on the DNC list." : "Invalid phone number." });
    return result("skipped");
  }

  const { data: recent } = await supabase
    .from("message_logs")
    .select("id")
    .eq("contact_id", contact.id)
    .eq("campaign_id", campaign.id)
    .eq("purpose", "business_details")
    .eq("status", "sent")
    .gte("created_at", new Date(Date.now() - RESEND_WINDOW_MS).toISOString())
    .limit(1);
  if (recent?.length) {
    return result("already_sent");
  }

  const config = getWhatsAppConfig();
  if (!config) {
    await log("not_configured", { error: "WhatsApp is not configured (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID)." });
    return result("not_configured");
  }

  const [{ data: business }, { data: sources }] = await Promise.all([
    supabase
      .from("businesses")
      .select("business_name, description, website, business_phone, business_email")
      .eq("id", contact.business_id)
      .single(),
    supabase.from("campaign_sources").select("raw_text").eq("campaign_id", campaign.id),
  ]);

  if (!business) {
    await log("failed", { error: "Business not found." });
    return result("failed");
  }

  const message = buildBusinessDetailsMessage({
    business,
    campaign,
    sources: sources || [],
    customerName: contact.name,
  });

  const sent = await sendBusinessDetailsWhatsApp(config, phone.normalized, message);
  if (!sent.ok) {
    console.error("WhatsApp business details failed:", sent.error);
    await log("failed", { error: sent.error });
    return result("failed");
  }

  await log("sent", { provider_message_id: sent.messageId });
  return result("sent");
}
