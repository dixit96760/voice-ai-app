/**
 * Standalone Sarvam connection check.
 *
 *   npm run sarvam:check
 *
 * Reads .env.local directly (no Supabase or Next.js required) and reports:
 *  1. which configuration values are missing, and
 *  2. whether the Voice Agents scheduling API accepts the configured key/scope.
 */

import * as fs from "node:fs";
import * as path from "node:path";

function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) process.env[key] = value;
  }
}

/** Asks the Model API whether a key is a live Sarvam key at all. */
async function classifyModelApiKey(key: string): Promise<"live" | "rejected" | "unknown"> {
  try {
    const response = await fetch("https://api.sarvam.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "api-subscription-key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sarvam-105b",
        messages: [{ role: "user", content: "Say OK" }],
        max_tokens: 1,
      }),
    });
    if (response.status === 200) return "live";
    if (response.status === 401 || response.status === 403) return "rejected";
    // 400/402/429 mean the key authenticated and the request was judged on other grounds.
    return "live";
  } catch {
    return "unknown";
  }
}

async function main() {
  const root = process.cwd();
  for (const file of [".env.local", ".env"]) {
    loadEnvFile(path.join(root, file));
  }

  // Imported after env load so the provider reads the resolved values.
  const { getSarvamConfigStatus, listSarvamCampaigns, sarvamFetch, SarvamProviderError } =
    await import("../lib/providers/sarvam");

  const status = getSarvamConfigStatus();
  const probeAuth = process.argv.includes("--probe-auth");

  console.log("Sarvam Voice Agents — connection check");
  console.log("======================================");
  console.log(`Base URL            : ${status.baseUrl}`);
  console.log(`API key             : ${status.apiKeySource}`);
  console.log(`Organisation        : ${status.orgId || "(not set)"}`);
  console.log(`Workspace           : ${status.workspaceId || "(not set)"}`);
  console.log(`Agent app id        : ${status.agentAppId || "(not set)"}`);
  console.log(`Agent version       : ${status.agentAppVersion ?? "(not set)"}`);
  console.log(`Telephony connection: ${status.connectionId || "(not set)"}`);
  console.log(`Webhook verification: ${status.webhookVerification}`);
  console.log(`Webhook URL         : ${status.webhookUrl}`);
  console.log(`Mock mode           : ${status.mockMode}`);

  if (status.missing.length > 0) {
    console.log("\nMissing configuration:");
    for (const key of status.missing) {
      console.log(`  - ${key}: ${status.hints[key] ?? ""}`);
    }
  }

  if (probeAuth) {
    // Validates the key itself without needing the real org/workspace ids.
    // A rejection mentioning the key format means the wrong key type is configured;
    // any other answer means the key was accepted and only ids are missing.
    const candidateKey =
      process.env.SARVAM_VOICE_AGENTS_API_KEY?.trim() || process.env.SARVAM_API_KEY?.trim() || "";

    if (!candidateKey) {
      console.log("\nNo Sarvam key configured; nothing to probe.");
    } else {
      console.log("\nProbing the key against the scheduling API (dummy org/workspace)...");
      try {
        await sarvamFetch(
          "/api/scheduling/v1/orgs/check-org/workspaces/check-ws/campaigns?limit=1"
        );
        console.log("  key accepted by the scheduling API.");
      } catch (err: unknown) {
        const providerError = err instanceof SarvamProviderError ? err : null;
        const message = (err as Error)?.message ?? String(err);
        // "Invalid API key format" is a header/format rejection (wrong key type),
        // while "Authentication failed" means the format was accepted and the
        // lookup failed - usually org/workspace scope, or an inactive key.
        const formatRejected = /key format/i.test(message);
        const authFailed = /authentication failed|unauthorized|invalid bearer/i.test(message);

        console.log(`  http status : ${providerError?.statusCode ?? "n/a"}`);
        console.log(`  provider msg: ${message.slice(0, 300)}`);

        if (!formatRejected && !authFailed) {
          console.log("  verdict     : key accepted; remaining failures are org/workspace scope.");
        } else if (formatRejected) {
          console.log("  verdict     : REJECTED — the key format is not a Voice Agents key.");
          console.log("  model API   : checking whether this is a Model API key ...");
          const modelStatus = await classifyModelApiKey(candidateKey);

          if (modelStatus === "live") {
            console.log("  diagnosis   : this is a LIVE Sarvam **Model API** key (api.sarvam.ai).");
            console.log(
              "                Voice Agents issues a separate key. Create one at\n" +
                "                https://indus.sarvam.ai/samvaad  ->  Settings  ->  API Key\n" +
                "                and set SARVAM_VOICE_AGENTS_API_KEY."
            );
          } else if (modelStatus === "rejected") {
            console.log(
              "  diagnosis   : the key is rejected by BOTH Sarvam APIs. It is likely\n" +
                "                expired, revoked, or from a different Sarvam account."
            );
          } else {
            console.log("  diagnosis   : the key was rejected and the Model API was unreachable.");
          }
        } else {
          console.log("  verdict     : key FORMAT accepted (correct key type), but authentication failed.");
          console.log(
            "  next        : set SARVAM_ORG_ID and SARVAM_WORKSPACE_ID, then re-run.\n" +
              "                Copy them from Voice Agents -> Settings, or from the URL of\n" +
                "                Deploy -> Deploy with Code (indus.sarvam.ai/samvaad/deploy/with-code),\n" +
                "                which shows a ready-made curl snippet containing both ids.\n" +
                "                If it still fails with the correct ids, the key is inactive -\n" +
                "                rotate it in Settings -> API Key."
          );
        }
      }
    }
  }

  if (!status.ready) {
    console.log("\nResult: NOT READY (no campaign request was sent to Sarvam).");
    return;
  }

  console.log("\nContacting Sarvam (GET .../campaigns?limit=5) ...");
  try {
    const campaigns = await listSarvamCampaigns({ limit: 5 });
    console.log(`Result: OK — ${campaigns.total} campaign(s) in this workspace.`);
    for (const item of campaigns.items) {
      console.log(
        `  - ${item.name} [${item.campaign_id}] ${item.status} agent=${item.app_id} v${item.app_version ?? "-"}`
      );
    }
  } catch (err: unknown) {
    const providerError = err instanceof SarvamProviderError ? err : null;
    console.log("Result: FAILED");
    console.log(`  code   : ${providerError?.code ?? "UNKNOWN_PROVIDER_ERROR"}`);
    console.log(`  message: ${(err as Error)?.message ?? String(err)}`);
    if (providerError?.statusCode) {
      console.log(`  status : ${providerError.statusCode}`);
    }
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error("sarvam:check failed:", err);
  process.exitCode = 1;
});
