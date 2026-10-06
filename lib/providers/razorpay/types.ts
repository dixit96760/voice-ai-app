/**
 * Official Razorpay API Data Types & Payloads
 * Verified against current official Razorpay documentation
 */

export type RazorpayBillingPeriod = "daily" | "weekly" | "monthly" | "yearly";

export interface RazorpayPlanItem {
  id?: string;
  name: string;
  amount: number; // in paise
  currency: "INR";
  description?: string;
  active?: boolean;
}

export interface RazorpayCreatePlanRequest {
  period: RazorpayBillingPeriod;
  interval: number; // e.g. 1 for monthly, 3 for quarterly
  item: RazorpayPlanItem;
  notes?: Record<string, string>;
}

export interface RazorpayPlanResponse {
  id: string;
  entity: "plan";
  interval: number;
  period: RazorpayBillingPeriod;
  item: RazorpayPlanItem;
  notes?: Record<string, string>;
  created_at: number;
}

export interface RazorpayCreateCustomerRequest {
  name: string;
  email: string;
  contact?: string;
  notes?: Record<string, string>;
}

export interface RazorpayCustomerResponse {
  id: string;
  entity: "customer";
  name: string;
  email: string;
  contact: string;
  notes?: Record<string, string>;
  created_at: number;
}

export interface RazorpayCreateSubscriptionRequest {
  plan_id: string;
  total_count: number;
  quantity?: number;
  customer_notify?: 0 | 1;
  customer_id?: string; // Optional per Razorpay documentation
  start_at?: number; // Epoch seconds
  expire_by?: number;
  addons?: Array<{
    item: {
      name: string;
      amount: number;
      currency: string;
    };
  }>;
  notes?: Record<string, string>;
}

export interface RazorpaySubscriptionResponse {
  id: string;
  entity: "subscription";
  plan_id: string;
  customer_id?: string | null;
  status:
    | "created"
    | "authenticated"
    | "active"
    | "pending"
    | "halted"
    | "cancelled"
    | "completed"
    | "expired";
  current_start: number | null;
  current_end: number | null;
  ended_at: number | null;
  quantity: number;
  charge_at: number | null;
  start_at: number | null;
  end_at: number | null;
  auth_attempts: number;
  total_count: number;
  paid_count: number;
  remaining_count: number;
  short_url?: string;
  notes?: Record<string, string>;
  created_at: number;
}

export interface RazorpayCancelSubscriptionRequest {
  cancel_at_cycle_end: 0 | 1;
}

export interface RazorpayPaymentResponse {
  id: string;
  entity: "payment";
  amount: number; // paise
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  order_id: string | null;
  invoice_id: string | null;
  international: boolean;
  method: string; // upi, card, netbanking, emandate
  amount_refunded: number;
  refund_status: string | null;
  captured: boolean;
  description: string | null;
  card_id: string | null;
  bank: string | null;
  wallet: string | null;
  vpa: string | null;
  email: string;
  contact: string;
  notes?: Record<string, string>;
  error_code: string | null;
  error_description: string | null;
  error_source: string | null;
  error_step: string | null;
  error_reason: string | null;
  created_at: number;
}

export interface RazorpayCreateRefundRequest {
  amount?: number; // paise
  reverse_all?: boolean;
  speed?: "normal" | "optimum";
  notes?: Record<string, string>;
  receipt?: string;
}

export interface RazorpayRefundResponse {
  id: string;
  entity: "refund";
  amount: number;
  currency: string;
  payment_id: string;
  notes?: Record<string, string>;
  receipt: string | null;
  status: "pending" | "processed" | "failed";
  speed_processed: string;
  speed_requested: string;
  created_at: number;
}

export interface RazorpayWebhookPayload {
  entity: "event";
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    subscription?: {
      entity: RazorpaySubscriptionResponse;
    };
    payment?: {
      entity: RazorpayPaymentResponse;
    };
    refund?: {
      entity: RazorpayRefundResponse;
    };
    order?: {
      entity: Record<string, unknown>;
    };
  };
  created_at: number; // Epoch seconds
}
