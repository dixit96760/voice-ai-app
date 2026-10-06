import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getSarvamConfigStatus,
  listSarvamCampaigns,
  SarvamProviderError,
} from "@/lib/providers/sarvam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only diagnostics for the Sarvam Voice Agents integration.
 * GET /api/integrations/sarvam/status         → configuration snapshot
 * GET /api/integrations/sarvam/status?verify=1 → live call against Sarvam
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    }

    const status = getSarvamConfigStatus();

    if (req.nextUrl.searchParams.get("verify") !== "1") {
      return NextResponse.json({ ok: true, status });
    }

    if (!status.ready) {
      return NextResponse.json(
        {
          ok: false,
          status,
          error: `Missing configuration: ${status.missing.join(", ")}`,
        },
        { status: 400 }
      );
    }

    try {
      const campaigns = await listSarvamCampaigns({ limit: 5 });
      return NextResponse.json({
        ok: true,
        status,
        live: {
          reachable: true,
          totalCampaigns: campaigns.total,
          recent: campaigns.items.map((item) => ({
            campaign_id: item.campaign_id,
            name: item.name,
            status: item.status,
            app_id: item.app_id,
            app_version: item.app_version,
          })),
        },
      });
    } catch (err: unknown) {
      const providerError =
        err instanceof SarvamProviderError ? err : null;
      return NextResponse.json(
        {
          ok: false,
          status,
          live: {
            reachable: false,
            code: providerError?.code || "UNKNOWN_PROVIDER_ERROR",
            message:
              (err as Error)?.message || "Could not reach the Sarvam API.",
          },
        },
        { status: 502 }
      );
    }
  } catch (err: unknown) {
    console.error("Sarvam status check failed:", err);
    return NextResponse.json(
      { error: "Failed to read Sarvam integration status." },
      { status: 500 }
    );
  }
}
