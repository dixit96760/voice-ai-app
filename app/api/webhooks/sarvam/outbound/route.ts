import { NextRequest, NextResponse } from "next/server";
import { processCampaignWebhook } from "@/lib/telephony/webhook-service";
import { verifySarvamWebhook } from "@/lib/providers/sarvam/webhook-auth";
import { sha256Hex } from "@/lib/security/webhook-signature";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  toCampaignPayload,
  type SarvamInstantOutboundPayload,
} from "@/lib/telephony/outbound-webhook";

export const runtime = "nodejs";

const MAX_WEBHOOK_BYTES = 1_000_000;

/** Results of callback calls placed by the scheduler (Sarvam instant outbound). */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (!rawBody || Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BYTES) {
      return NextResponse.json({ error: "Invalid or oversized payload." }, { status: 413 });
    }

    const verification = verifySarvamWebhook(
      req.headers,
      rawBody,
      req.nextUrl.searchParams.get("token")
    );
    if (!verification.valid) {
      return NextResponse.json({ error: verification.reason || "Unauthorized." }, { status: 401 });
    }

    let payload: SarvamInstantOutboundPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const callbackId = payload.webhook_config?.metadata?.callback_id;
    const converted = toCampaignPayload(payload);

    let callId: string | undefined;
    if (converted) {
      const result = await processCampaignWebhook(converted, {
        payloadHash: sha256Hex(rawBody),
        signatureValid: true,
        signatureProvider: `sarvam:${verification.method}`,
      });
      if (!result.success && result.retryable) {
        return NextResponse.json({ received: true, error: result.error }, { status: 503 });
      }
      callId = result.callId;
    }

    if (callbackId) {
      const connected = payload.status === "connected";
      const now = new Date().toISOString();
      await createAdminClient()
        .from("callbacks")
        .update({
          status: connected ? "COMPLETED" : "MISSED",
          completed_at: connected ? now : null,
          updated_at: now,
        })
        .eq("id", callbackId)
        .in("status", ["QUEUED", "CALLING"]);
    }

    return NextResponse.json({ received: true, callId: callId || null });
  } catch (err: unknown) {
    console.error("Fatal error handling Sarvam outbound webhook:", err);
    return NextResponse.json({ received: false, error: "Webhook processing failed." }, { status: 500 });
  }
}
