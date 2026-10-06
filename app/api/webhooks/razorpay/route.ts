import { NextRequest, NextResponse } from "next/server";
import { razorpayWebhookService } from "@/lib/billing/webhook-service";
import { assertRateLimit } from "@/lib/security/rate-limiter";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // 1. Rate Limiting Check (100 req/min per IP)
  const clientIp = request.ip || request.headers.get("x-forwarded-for") || "anonymous";
  const rateLimit = await assertRateLimit(`rl:webhook:razorpay:${clientIp}`, 100, 1.6);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many webhook requests. Rate limit exceeded." },
      {
        status: 429,
        headers: { "Retry-After": Math.ceil(rateLimit.retryAfterMs / 1000).toString() },
      }
    );
  }

  // 2. Read Raw Request Body Buffer (CRITICAL: Do not parse JSON before signature check)
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > 1_000_000) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }
  const signature = request.headers.get("x-razorpay-signature");
  const eventIdHeader = request.headers.get("x-razorpay-event-id");
  const webhookSecret =
    env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET || "";

  if (!webhookSecret || /mock|placeholder|your-/i.test(webhookSecret)) {
    return NextResponse.json(
      { error: "Webhook authentication is not configured." },
      { status: 503 }
    );
  }

  if (!signature) {
    return NextResponse.json(
      { error: "Missing required X-Razorpay-Signature header." },
      { status: 400 }
    );
  }

  // 3. Process Webhook
  const result = await razorpayWebhookService.processWebhook(
    rawBody,
    signature,
    webhookSecret,
    eventIdHeader
  );

  return NextResponse.json(
    {
      message: result.message,
      processed: result.processed,
      ignored: result.ignored,
      reason: result.reason,
      eventId: result.eventId,
    },
    { status: result.statusCode }
  );
}
