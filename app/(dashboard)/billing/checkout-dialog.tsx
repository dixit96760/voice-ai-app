"use client";

import { useEffect, useState } from "react";
import {
  createSubscriptionCheckoutAction,
  verifySubscriptionPaymentAction,
} from "@/lib/billing/actions";
import { Loader2, ShieldCheck } from "lucide-react";

interface CheckoutDialogProps {
  planVersionId: string;
  planName: string;
  pricePaise: number;
  billingPeriod: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true);
      return;
    }
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function CheckoutDialog({
  planVersionId,
  planName,
  pricePaise,
  billingPeriod,
  isOpen,
  onClose,
  onSuccess,
}: CheckoutDialogProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const handleStartCheckout = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const session = await createSubscriptionCheckoutAction(planVersionId);
      if (!session.success || !session.razorpaySubscriptionId) {
        setErrorMessage(session.error || "Failed to initialize payment session.");
        setLoading(false);
        return;
      }

      // Check if running in mock/test mode
      const isMock =
        process.env.NODE_ENV === "test" ||
        session.razorpayKeyId?.startsWith("rzp_test_mock") ||
        session.razorpayKeyId === "";

      if (isMock) {
        // Automatically verify mock checkout in test/mock environment
        const mockPaymentId = `pay_mock_${Date.now()}`;
        const mockSignature = `sig_mock_${Date.now()}`;

        const verifyRes = await verifySubscriptionPaymentAction(
          mockPaymentId,
          session.razorpaySubscriptionId,
          mockSignature,
          planVersionId
        );

        if (verifyRes.success) {
          setLoading(false);
          onSuccess();
          onClose();
        } else {
          setErrorMessage(verifyRes.error || "Mock verification failed.");
          setLoading(false);
        }
        return;
      }

      // Ensure Razorpay SDK is loaded
      const scriptReady = await loadRazorpayScript();
      if (!scriptReady || typeof window.Razorpay === "undefined") {
        setErrorMessage(
          "Payment gateway (Razorpay) failed to load. Please check your internet connection or ad-blocker and try again."
        );
        setLoading(false);
        return;
      }

      // Live Razorpay standard checkout
      const options = {
        key: session.razorpayKeyId,
        subscription_id: session.razorpaySubscriptionId,
        name: "Voice Calling SaaS",
        description: `${planName} Subscription (${billingPeriod})`,
        theme: { color: "#4f46e5" },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_subscription_id: string;
          razorpay_signature: string;
        }) => {
          setLoading(true);
          const verifyRes = await verifySubscriptionPaymentAction(
            response.razorpay_payment_id,
            response.razorpay_subscription_id,
            response.razorpay_signature,
            planVersionId
          );

          setLoading(false);
          if (verifyRes.success) {
            onSuccess();
            onClose();
          } else {
            setErrorMessage(verifyRes.error || "Signature verification failed.");
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
      setLoading(false);
    }
  };

  const formattedPrice = `₹${(pricePaise / 100).toLocaleString("en-IN")}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-dialog-title"
    >
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b">
          <h3 id="checkout-dialog-title" className="text-lg font-semibold text-foreground">
            Upgrade to {planName}
          </h3>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Close checkout dialog"
          >
            ✕
          </button>
        </div>

        <div className="py-6 space-y-4">
          <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-primary font-medium">Billed {billingPeriod}</p>
              <p className="text-2xl font-bold text-foreground">{formattedPrice}</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs text-primary">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>UPI / e-Mandate</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Automatic recurring debits are scheduled via Razorpay Subscriptions. You can cancel anytime from your billing settings before the next renewal date.
          </p>

          {errorMessage && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStartCheckout}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>Proceed to Checkout</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
