import type { Database } from "@/lib/supabase/types";

type Business = Database["public"]["Tables"]["businesses"]["Row"];
type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];
type CampaignSource = Database["public"]["Tables"]["campaign_sources"]["Row"];

/** WhatsApp template parameters allow up to 1,024 characters. */
const MAX_DETAILS_CHARS = 900;

/**
 * WhatsApp rejects template parameters containing newlines, tabs or more than
 * four consecutive spaces, so every value is flattened to one clean line.
 */
export function toTemplateParam(value: string, maxLength = MAX_DETAILS_CHARS): string {
  const flat = value.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
  return flat.length > maxLength ? `${flat.slice(0, maxLength - 3)}...` : flat;
}

export interface BusinessDetailsMessage {
  customerName: string;
  businessName: string;
  details: string;
  contactInfo: string;
}

/**
 * The details a customer asked for during a call: what the business does,
 * this campaign's offer, the approved facts, and how to get in touch.
 */
export function buildBusinessDetailsMessage({
  business,
  campaign,
  sources,
  customerName,
}: {
  business: Pick<
    Business,
    "business_name" | "description" | "website" | "business_phone" | "business_email"
  >;
  campaign: Pick<Campaign, "offering_type" | "description">;
  sources: Pick<CampaignSource, "raw_text">[];
  customerName?: string | null;
}): BusinessDetailsMessage {
  const facts = sources
    .map((s) => s.raw_text?.trim() || "")
    .filter(Boolean)
    .join(" ");

  const details = [
    campaign.offering_type ? `${campaign.offering_type}.` : "",
    campaign.description || "",
    facts,
    business.description ? `About us: ${business.description}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const contactInfo = [
    business.website ? `Website: ${business.website}` : "",
    business.business_phone ? `Phone: ${business.business_phone}` : "",
    business.business_email ? `Email: ${business.business_email}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    customerName: toTemplateParam(customerName || "there", 60),
    businessName: toTemplateParam(business.business_name, 120),
    details: toTemplateParam(details || "Our team will share full details with you shortly."),
    contactInfo: toTemplateParam(contactInfo || "Reply to this message and our team will help you.", 300),
  };
}
