import crypto from "crypto";

/**
 * Server-only cryptographic signature verification for Razorpay integrations.
 * Uses native Node.js crypto and constant-time buffer comparison to prevent timing attacks.
 */

/**
 * Verifies Razorpay incoming server-to-server webhook payload signature.
 * Header: X-Razorpay-Signature
 * Formula: HMAC-SHA256(raw_body_buffer_or_string, webhook_secret)
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string,
  webhookSecret: string
): boolean {
  if (!rawBody || !signatureHeader || !webhookSecret) {
    return false;
  }

  try {
    const computedHmac = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    const expectedBuffer = Buffer.from(computedHmac, "utf8");
    const receivedBuffer = Buffer.from(signatureHeader.trim(), "utf8");

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch {
    return false;
  }
}

/**
 * Verifies client-side Razorpay Checkout callback for recurring subscriptions.
 * Formula: HMAC-SHA256(razorpay_payment_id + "|" + razorpay_subscription_id, key_secret)
 */
export function verifySubscriptionCheckoutSignature(
  paymentId: string,
  subscriptionId: string,
  signature: string,
  keySecret: string
): boolean {
  if (!paymentId || !subscriptionId || !signature || !keySecret) {
    return false;
  }

  try {
    const payload = `${paymentId}|${subscriptionId}`;
    const computedHmac = crypto
      .createHmac("sha256", keySecret)
      .update(payload)
      .digest("hex");

    const expectedBuffer = Buffer.from(computedHmac, "utf8");
    const receivedBuffer = Buffer.from(signature.trim(), "utf8");

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch {
    return false;
  }
}

/**
 * Verifies standard one-time order checkout callback (for minute packs or add-ons).
 * Formula: HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)
 */
export function verifyOrderCheckoutSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret: string
): boolean {
  if (!orderId || !paymentId || !signature || !keySecret) {
    return false;
  }

  try {
    const payload = `${orderId}|${paymentId}`;
    const computedHmac = crypto
      .createHmac("sha256", keySecret)
      .update(payload)
      .digest("hex");

    const expectedBuffer = Buffer.from(computedHmac, "utf8");
    const receivedBuffer = Buffer.from(signature.trim(), "utf8");

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch {
    return false;
  }
}
