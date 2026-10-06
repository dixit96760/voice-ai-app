export interface PlanLimits {
  maxContacts: number;
  voiceMinutes: number;
  concurrentCalls: number;
  recordingRetentionDays: number;
}

export interface BillingPlan {
  id: string;
  name: string;
  priceInr: number;
  billingPeriod: "monthly" | "yearly";
  limits: PlanLimits;
}

export const PLANS: Record<string, BillingPlan> = {
  STARTER: {
    id: "plan_starter",
    name: "Starter",
    priceInr: 4999,
    billingPeriod: "monthly",
    limits: {
      maxContacts: 2500,
      voiceMinutes: 500,
      concurrentCalls: 2,
      recordingRetentionDays: 45,
    },
  },
  GROWTH: {
    id: "plan_growth",
    name: "Growth",
    priceInr: 12999,
    billingPeriod: "monthly",
    limits: {
      maxContacts: 10000,
      voiceMinutes: 2000,
      concurrentCalls: 5,
      recordingRetentionDays: 45,
    },
  },
};
