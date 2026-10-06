import { env } from "@/lib/env";
import type {
  RazorpayCreatePlanRequest,
  RazorpayPlanResponse,
  RazorpayCreateCustomerRequest,
  RazorpayCustomerResponse,
  RazorpayCreateSubscriptionRequest,
  RazorpaySubscriptionResponse,
  RazorpayPaymentResponse,
  RazorpayCreateRefundRequest,
  RazorpayRefundResponse,
} from "./types";

if (typeof window !== "undefined") {
  throw new Error(
    "Security Violation: Razorpay provider client must NEVER be bundled or executed in the browser."
  );
}

export class RazorpayClient {
  private keyId: string;
  private keySecret: string;
  private baseUrl: string = "https://api.razorpay.com/v1";
  private isMock: boolean;

  constructor() {
    this.keyId = env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "";
    this.keySecret = env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || "";
    this.isMock =
      process.env.NODE_ENV === "test" ||
      (process.env.NODE_ENV !== "production" &&
        (env.RAZORPAY_MOCK_MODE === "true" ||
          process.env.RAZORPAY_MOCK_MODE === "true"));
  }

  isMockMode(): boolean {
    return this.isMock;
  }

  private getAuthHeader(): string {
    const creds = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
    return `Basic ${creds}`;
  }

  private async request<T>(
    endpoint: string,
    method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        Authorization: this.getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let parsedError: Record<string, unknown> = {};
      try {
        parsedError = JSON.parse(errorText);
      } catch {
        parsedError = { description: errorText };
      }
      throw new Error(
        `Razorpay API Error (${response.status}): ${(parsedError as { error?: { description?: string } }).error?.description || errorText}`
      );
    }

    return (await response.json()) as T;
  }

  // 1. Create Plan
  async createPlan(params: RazorpayCreatePlanRequest): Promise<RazorpayPlanResponse> {
    if (this.isMock) {
      return {
        id: `plan_mock_${Date.now()}`,
        entity: "plan",
        interval: params.interval,
        period: params.period,
        item: {
          id: `item_mock_${Date.now()}`,
          name: params.item.name,
          amount: params.item.amount,
          currency: "INR",
          description: params.item.description || "",
          active: true,
        },
        notes: params.notes || {},
        created_at: Math.floor(Date.now() / 1000),
      };
    }

    return this.request<RazorpayPlanResponse>("/plans", "POST", params);
  }

  // 2. Fetch Plan
  async getPlan(planId: string): Promise<RazorpayPlanResponse> {
    if (this.isMock) {
      return {
        id: planId,
        entity: "plan",
        interval: 1,
        period: "monthly",
        item: {
          id: `item_${planId}`,
          name: "Mock Plan",
          amount: 299900,
          currency: "INR",
          active: true,
        },
        created_at: Math.floor(Date.now() / 1000) - 86400,
      };
    }

    return this.request<RazorpayPlanResponse>(`/plans/${planId}`, "GET");
  }

  // 3. Create Customer (Optional)
  async createCustomer(params: RazorpayCreateCustomerRequest): Promise<RazorpayCustomerResponse> {
    if (this.isMock) {
      return {
        id: `cust_mock_${Date.now()}`,
        entity: "customer",
        name: params.name,
        email: params.email,
        contact: params.contact || "+919999999999",
        notes: params.notes || {},
        created_at: Math.floor(Date.now() / 1000),
      };
    }

    return this.request<RazorpayCustomerResponse>("/customers", "POST", params);
  }

  // 4. Create Subscription
  async createSubscription(
    params: RazorpayCreateSubscriptionRequest
  ): Promise<RazorpaySubscriptionResponse> {
    if (this.isMock) {
      const nowEpoch = Math.floor(Date.now() / 1000);
      return {
        id: `sub_mock_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        entity: "subscription",
        plan_id: params.plan_id,
        customer_id: params.customer_id || null,
        status: "created",
        current_start: null,
        current_end: null,
        ended_at: null,
        quantity: params.quantity || 1,
        charge_at: nowEpoch,
        start_at: nowEpoch,
        end_at: nowEpoch + 365 * 86400,
        auth_attempts: 0,
        total_count: params.total_count,
        paid_count: 0,
        remaining_count: params.total_count,
        short_url: `https://rzp.io/i/mock_${Date.now()}`,
        notes: params.notes || {},
        created_at: nowEpoch,
      };
    }

    return this.request<RazorpaySubscriptionResponse>("/subscriptions", "POST", params);
  }

  // 5. Fetch Subscription
  async getSubscription(subscriptionId: string): Promise<RazorpaySubscriptionResponse> {
    if (this.isMock) {
      const nowEpoch = Math.floor(Date.now() / 1000);
      return {
        id: subscriptionId,
        entity: "subscription",
        plan_id: "plan_mock_default",
        customer_id: null,
        status: "active",
        current_start: nowEpoch - 86400 * 5,
        current_end: nowEpoch + 86400 * 25,
        ended_at: null,
        quantity: 1,
        charge_at: nowEpoch + 86400 * 25,
        start_at: nowEpoch - 86400 * 5,
        end_at: nowEpoch + 365 * 86400,
        auth_attempts: 1,
        total_count: 12,
        paid_count: 1,
        remaining_count: 11,
        created_at: nowEpoch - 86400 * 5,
      };
    }

    return this.request<RazorpaySubscriptionResponse>(`/subscriptions/${subscriptionId}`, "GET");
  }

  // 6. Cancel Subscription
  async cancelSubscription(
    subscriptionId: string,
    cancelAtCycleEnd: boolean = false
  ): Promise<RazorpaySubscriptionResponse> {
    if (this.isMock) {
      const nowEpoch = Math.floor(Date.now() / 1000);
      return {
        id: subscriptionId,
        entity: "subscription",
        plan_id: "plan_mock_default",
        customer_id: null,
        status: cancelAtCycleEnd ? "active" : "cancelled",
        current_start: nowEpoch - 86400 * 10,
        current_end: nowEpoch + 86400 * 20,
        ended_at: cancelAtCycleEnd ? null : nowEpoch,
        quantity: 1,
        charge_at: null,
        start_at: nowEpoch - 86400 * 10,
        end_at: nowEpoch + 365 * 86400,
        auth_attempts: 1,
        total_count: 12,
        paid_count: 1,
        remaining_count: 0,
        created_at: nowEpoch - 86400 * 10,
      };
    }

    return this.request<RazorpaySubscriptionResponse>(
      `/subscriptions/${subscriptionId}/cancel`,
      "POST",
      { cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0 }
    );
  }

  // 7. Pause Subscription
  async pauseSubscription(subscriptionId: string): Promise<RazorpaySubscriptionResponse> {
    if (this.isMock) {
      const sub = await this.getSubscription(subscriptionId);
      return { ...sub, status: "pending" };
    }

    return this.request<RazorpaySubscriptionResponse>(
      `/subscriptions/${subscriptionId}/pause`,
      "POST",
      { pause_at: "now" }
    );
  }

  // 8. Resume Subscription
  async resumeSubscription(subscriptionId: string): Promise<RazorpaySubscriptionResponse> {
    if (this.isMock) {
      const sub = await this.getSubscription(subscriptionId);
      return { ...sub, status: "active" };
    }

    return this.request<RazorpaySubscriptionResponse>(
      `/subscriptions/${subscriptionId}/resume`,
      "POST",
      { resume_at: "now" }
    );
  }

  // 9. Fetch Payment
  async getPayment(paymentId: string): Promise<RazorpayPaymentResponse> {
    if (this.isMock) {
      return {
        id: paymentId,
        entity: "payment",
        amount: 299900,
        currency: "INR",
        status: "captured",
        order_id: null,
        invoice_id: `inv_mock_${Date.now()}`,
        international: false,
        method: "upi",
        amount_refunded: 0,
        refund_status: null,
        captured: true,
        description: "Monthly subscription charge",
        card_id: null,
        bank: null,
        wallet: null,
        vpa: "user@okaxis",
        email: "billing@business.in",
        contact: "+919876543210",
        error_code: null,
        error_description: null,
        error_source: null,
        error_step: null,
        error_reason: null,
        created_at: Math.floor(Date.now() / 1000),
      };
    }

    return this.request<RazorpayPaymentResponse>(`/payments/${paymentId}`, "GET");
  }

  // 10. Refund Payment
  async createRefund(
    paymentId: string,
    params?: RazorpayCreateRefundRequest
  ): Promise<RazorpayRefundResponse> {
    if (this.isMock) {
      return {
        id: `rfnd_mock_${Date.now()}`,
        entity: "refund",
        amount: params?.amount || 299900,
        currency: "INR",
        payment_id: paymentId,
        notes: params?.notes || {},
        receipt: params?.receipt || null,
        status: "processed",
        speed_processed: "normal",
        speed_requested: "normal",
        created_at: Math.floor(Date.now() / 1000),
      };
    }

    return this.request<RazorpayRefundResponse>(`/payments/${paymentId}/refund`, "POST", params || {});
  }
}

export const razorpayClient = new RazorpayClient();
