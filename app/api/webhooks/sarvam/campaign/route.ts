import { NextRequest, NextResponse } from "next/server";
import { processCampaignWebhook } from "@/lib/telephony/webhook-service";
import { SarvamCampaignWebhookPayload } from "@/lib/providers/sarvam/types";
import { verifySarvamWebhook } from "@/lib/providers/sarvam/webhook-auth";
import { assertRateLimit } from "@/lib/security/rate-limiter";
import { sha256Hex } from "@/lib/security/webhook-signature";

export const runtime = "nodejs";

const MAX_WEBHOOK_BYTES = 1_000_000;

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get("content-length") || "0");
    if (contentLength > MAX_WEBHOOK_BYTES) {
      return NextResponse.json({ error: "Payload too large." }, { status: 413 });
    }

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateLimit = await assertRateLimit(
      `rl:webhook:sarvam:${clientIp}`,
      600,
      10
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many webhook requests." },
        {
          status: 429,
          headers: { "Retry-After": Math.ceil(rateLimit.retryAfterMs / 1000).toString() },
        }
      );
    }

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
      return NextResponse.json(
        { error: verification.reason || "Invalid webhook signature." },
        { status: 401 }
      );
    }

    let rawPayload: unknown;
    try {
      rawPayload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    if (!rawPayload || typeof rawPayload !== "object") {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const payload = rawPayload as SarvamCampaignWebhookPayload;
    if (
      !payload.attempt_id ||
      !payload.app_id ||
      !payload.campaign_id ||
      !payload.user_phone_number ||
      !payload.completion_status
    ) {
      return NextResponse.json(
        { error: "Missing required webhook fields." },
        { status: 400 }
      );
    }

    const result = await processCampaignWebhook(payload, {
      payloadHash: sha256Hex(rawBody),
      signatureValid: true,
      signatureProvider: `sarvam:${verification.method}`,
    });

    if (!result.success) {
      console.error("Webhook processing error:", result.error);
      // A non-2xx status asks Sarvam to redeliver; permanent failures (such as
      // an unknown campaign) are acknowledged so they are not retried forever.
      return NextResponse.json(
        { received: true, status: "error", error: result.error },
        { status: result.retryable ? 503 : 200 }
      );
    }

    return NextResponse.json(
      {
        received: true,
        alreadyProcessed: result.alreadyProcessed || false,
        attemptId: result.attemptId,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    console.error("Fatal error handling Sarvam campaign webhook:", err);
    return NextResponse.json(
      { received: false, error: "Webhook processing failed." },
      { status: 500 }
    );
  }
}
