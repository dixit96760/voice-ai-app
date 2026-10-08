import { SarvamAgentConfig } from "./types";
import type { Database } from "@/lib/supabase/types";

type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];
type CampaignVersion = Database["public"]["Tables"]["campaign_versions"]["Row"];
type CampaignSource = Database["public"]["Tables"]["campaign_sources"]["Row"];
type Business = Database["public"]["Tables"]["businesses"]["Row"];

export interface BuildAgentConfigParams {
  business: Business;
  campaign: Campaign;
  version: CampaignVersion;
  sources: CampaignSource[];
}

/** Keeps the per-contact brief well inside provider variable limits. */
const MAX_CAMPAIGN_BRIEF_CHARS = 3000;

/**
 * Plain-text brief of what this campaign is about, streamed to the agent as
 * the `campaign_brief` variable. The Sarvam campaign API only references an
 * existing agent, so this is how one shared agent learns each campaign's
 * offer, pitch and approved facts.
 */
export function buildCampaignBrief({
  business,
  campaign,
  sources,
}: Omit<BuildAgentConfigParams, "version">): string {
  const facts = sources
    .filter((s) => s.processing_status === "READY" || (s.raw_text && s.raw_text.trim().length > 0))
    .map((s) => s.raw_text?.trim() || "")
    .filter(Boolean)
    .join(" ");

  const brief = [
    `Business: ${business.business_name}`,
    business.description ? `About the business: ${business.description}` : "",
    `Offering: ${campaign.offering_type || "Our services"}`,
    `Goal of this call: ${campaign.objective || "Share the offer and gauge interest"}`,
    campaign.description ? `Pitch and offer details: ${campaign.description}` : "",
    facts ? `Approved facts (only use these): ${facts}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return brief.length > MAX_CAMPAIGN_BRIEF_CHARS
    ? `${brief.slice(0, MAX_CAMPAIGN_BRIEF_CHARS - 3)}...`
    : brief;
}

/**
 * Builds a Sarvam Agent Configuration from internal SaaS domain entities.
 * Grounded in approved campaign knowledge with strict safety guardrails.
 */
export function buildSarvamAgentConfig({
  business,
  campaign,
  version,
  sources,
}: BuildAgentConfigParams): SarvamAgentConfig {
  const config = (version.configuration || {}) as Record<string, unknown>;
  const language = String(config.language || config.preferredLanguage || "en-IN");
  const additionalLanguages = Array.isArray(config.additionalLanguages)
    ? (config.additionalLanguages as string[])
    : [];
  const tone = String(config.tone || "Friendly");
  const voiceId = String(config.voiceId || "ananya-friendly");
  const speechRate = typeof config.speechRate === "number" ? config.speechRate : 1.0;
  const temperature = typeof config.temperature === "number" ? config.temperature : 0.3;

  // 1. Compile Approved Knowledge Context
  const knowledgeSections = sources
    .filter((s) => s.processing_status === "READY" || (s.raw_text && s.raw_text.trim().length > 0))
    .map((s, idx) => {
      const typeLabel = s.source_type.toUpperCase();
      const content = s.raw_text?.trim() || "";
      return `### Knowledge Source ${idx + 1} [${typeLabel}]: ${s.source_name}\n${content}`;
    })
    .join("\n\n");

  // 2. Assemble System Prompt with Strict Safety Boundaries
  const systemPrompt = `
You are an AI sales and customer advisory representative calling on behalf of "${business.business_name}".

==================================================
1. CAMPAIGN IDENTITY & OBJECTIVE
==================================================
- Offering / Product: ${campaign.offering_type || "Our Services"}
- Objective: ${campaign.objective || "Qualify customer interest and provide helpful information"}
- Business Description: ${business.description || "Leading provider in India"}
- Persona / Tone: ${tone}, polite, concise, and respectful.
- Primary Language: ${language} (support code-mixing or switching to ${additionalLanguages.join(", ") || "Hindi / Indian English"} if preferred by customer).

==================================================
2. CALL OPENING GREETING
==================================================
Greet the contact warmly:
"Hello! Am I speaking with {contact_name}? I am calling from ${business.business_name} regarding our ${campaign.offering_type}."

==================================================
3. APPROVED KNOWLEDGE BASE
==================================================
Use ONLY the following approved facts to answer customer questions:

${knowledgeSections || "No specialized documents attached. Speak strictly about the core offering."}

==================================================
4. CRITICAL SAFETY & CONVERSATION RULES
==================================================
- HONESTY & FACTS: Never invent prices, discounts, availability, or commitments. If the answer is not in the approved knowledge above, say:
  "I don't have that specific detail right now, but I can have our senior specialist follow up with you."
- DO-NOT-CALL (DNC): If the contact asks to be removed from calling lists, stop calling, or states they do not want promotional calls, immediately respect it:
  "I completely understand. I will remove your number from our calling list immediately. Have a great day."
  Set variable 'dnc_requested' = true.
- WRONG NUMBER: If the contact states they are not the intended person, or this is a wrong number:
  "I apologize for disturbing you. I will update our records so you are not called again for this."
  Set variable 'wrong_number' = true. (Do NOT treat a wrong number as a DNC opt-out for the intended lead).
- CALLBACK REQUESTS: If the contact is busy or asks to be called back at a specific time:
  "Certainly! When would be the most convenient day and time to call you back?"
  Capture the requested time and set 'callback_requested' = true.
- CONVERSATION CONTROL: Keep your answers concise (1-2 sentences per response). Do not give long monologues over the phone.
- ABUSE / PROFANITY: If the caller is aggressive or abusive, respond courteously:
  "I apologize for any inconvenience. I will end the call now. Thank you for your time."
  Terminate the call politely.
`.trim();

  // 3. Define Structured Output Variables for Sarvam Agent
  const outputVariablesSchema: Record<string, unknown> = {
    call_outcome: {
      type: "string",
      enum: [
        "INTERESTED",
        "NOT_INTERESTED",
        "CALLBACK",
        "NO_ANSWER",
        "BUSY",
        "UNREACHABLE",
        "WRONG_NUMBER",
        "DO_NOT_CALL",
        "INFORMATION_REQUESTED",
        "OTHER",
      ],
      description: "Final outcome assessment of the call.",
    },
    interest_level: {
      type: "string",
      enum: ["HIGH", "MEDIUM", "LOW", "NONE"],
      description: "Assessed prospect interest level.",
    },
    callback_requested: {
      type: "boolean",
      description: "True if the contact requested a callback.",
    },
    callback_datetime: {
      type: "string",
      description: "Requested callback timestamp or preferred window (e.g. 'Tomorrow 3pm').",
    },
    dnc_requested: {
      type: "boolean",
      description: "True if the contact requested not to be called again.",
    },
    wrong_number: {
      type: "boolean",
      description: "True if the person who answered stated it is a wrong number.",
    },
    customer_questions: {
      type: "array",
      items: { type: "string" },
      description: "Key questions asked by the customer during the conversation.",
    },
    objections: {
      type: "array",
      items: { type: "string" },
      description: "Key objections raised by the prospect.",
    },
    next_action: {
      type: "string",
      description: "Recommended next operational action.",
    },
  };

  return {
    app_id: version.sarvam_agent_id || undefined,
    app_version: version.sarvam_agent_version_id || undefined,
    name: `${business.business_name} - ${campaign.name}`.slice(0, 100),
    system_prompt: systemPrompt,
    language,
    additional_languages: additionalLanguages,
    voice_id: voiceId,
    speech_rate: speechRate,
    temperature,
    tone,
    output_variables_schema: outputVariablesSchema,
  };
}
