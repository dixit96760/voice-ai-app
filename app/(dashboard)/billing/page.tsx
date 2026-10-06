import { fetchBillingDataAction } from "@/lib/billing/actions";
import { BillingClient } from "./billing-client";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Billing & Subscriptions | AI Voice SaaS",
};

export default async function BillingPage() {
  const data = await fetchBillingDataAction();

  if (!data) {
    redirect("/login");
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <BillingClient
        business={data.business}
        quotaStatus={data.quotaStatus}
        plans={data.plans}
        payments={data.payments}
        invoices={data.invoices}
      />
    </div>
  );
}
