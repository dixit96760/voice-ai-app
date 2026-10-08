import { NextRequest, NextResponse } from "next/server";
import { verifySarvamToolToken } from "@/lib/providers/sarvam/webhook-auth";
import { sendBusinessDetails } from "@/lib/messaging/send-business-details";
import { assertRateLimit } from "@/lib/security/rate-limiter";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Called by the Sarvam voice agent (API tool `send_business_details`) when a
 * customer asks for details during a call. Responds quickly with what the
 * agent should say; the agent tool times out after a few seconds.
 */
export async function POST(req: NextRequest) {
  if (!verifySarvamToolToken(req.nextUrl.searchParams.get("token"))) {
    return NextResponse.json({ error: "Invalid or missing token." }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const contactId = typeof body.contact_id === "string" ? body.contact_id.trim() : "";
  const campaignId = typeof body.campaign_id === "string" ? body.campaign_id.trim() : "";
  const interactionId =
    typeof body.interaction_id === "string" ? body.interaction_id.trim() : null;

  if (!UUID_PATTERN.test(contactId) || !UUID_PATTERN.test(campaignId)) {
    return NextResponse.json(
      {
        status: "skipped",
        agent_message: "Our team will share the details with you shortly.",
        error: "contact_id and campaign_id must be valid ids.",
      },
      { status: 200 }
    );
  }

  const rate = await assertRateLimit(`agent-tool:send-details:${contactId}`, 5, 5 / 3600);
  if (!rate.allowed) {
    return NextResponse.json({
      status: "already_sent",
      agent_message: "I have already sent the details to you on WhatsApp on this number.",
    });
  }

  try {
    const result = await sendBusinessDetails({ contactId, campaignId, interactionId });
    return NextResponse.json({ status: result.status, agent_message: result.agentMessage });
  } catch (err: unknown) {
    console.error("send-details tool failed:", err);
    return NextResponse.json({
      status: "failed",
      agent_message: "Our team will share the details with you shortly.",
    });
  }
}
