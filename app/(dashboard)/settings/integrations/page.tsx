import { requireBusiness } from "@/lib/auth/session";
import { getSarvamConfigStatus } from "@/lib/providers/sarvam";
import IntegrationsPanel from "./integrations-panel";

export const dynamic = "force-dynamic";

export default async function IntegrationsSettingsPage() {
  // Ensures the route is only reachable by an authenticated business account.
  await requireBusiness();

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Integrations
        </h1>
        <p className="text-sm text-muted-foreground">
          Connect the external services that power your campaigns.
        </p>
      </div>

      <IntegrationsPanel status={getSarvamConfigStatus()} />
    </div>
  );
}
