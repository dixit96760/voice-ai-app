import { sarvamFetch } from "./client";
import {
  getDefaultDialerNumbers,
  getSarvamScope,
  resolveAgentAppId,
  resolveAgentAppVersion,
  resolveConnectionId,
} from "./config";
import { SarvamProviderError } from "./errors";
import { normalizeIndianPhone } from "@/lib/validation/phone";

export interface SarvamInstantCallParams {
  userPhoneNumber: string;
  agentVariables: Record<string, string>;
  webhook: { url: string; metadata?: Record<string, string> };
}

interface SarvamInstantCallResponse {
  attempt_id: string;
}

/**
 * Places one outbound call right now (no campaign), used for scheduled
 * callbacks. Endpoint: POST /api/outbounds/v1/orgs/:org_id/workspaces/:workspace_id/outbounds
 */
export async function createSarvamInstantCall(
  params: SarvamInstantCallParams
): Promise<{ attemptId: string }> {
  const { orgId, workspaceId } = getSarvamScope();

  const user = normalizeIndianPhone(params.userPhoneNumber);
  if (!user.isValid || !user.normalized) {
    throw new SarvamProviderError(
      `Invalid callback phone number "${params.userPhoneNumber}".`,
      "INVALID_REQUEST",
      400,
      null,
      false
    );
  }

  const agentPhoneNumber = getDefaultDialerNumbers()[0];
  if (!agentPhoneNumber) {
    throw new SarvamProviderError(
      "SARVAM_DIALER_PHONE_NUMBERS must be set to place callback calls.",
      "PHONE_CONFIGURATION_ERROR",
      500,
      null,
      false
    );
  }

  const response = await sarvamFetch<SarvamInstantCallResponse>(
    `/api/outbounds/v1/orgs/${encodeURIComponent(orgId)}/workspaces/${encodeURIComponent(
      workspaceId
    )}/outbounds`,
    {
      method: "POST",
      body: JSON.stringify({
        app_config: {
          app_id: resolveAgentAppId(),
          app_version: resolveAgentAppVersion(),
          connection_config: {
            connection_id: resolveConnectionId(),
            agent_phone_number: agentPhoneNumber,
          },
          agent_variables: params.agentVariables,
        },
        user_config: { user_phone_number: user.normalized },
        webhook_config: params.webhook,
      }),
    }
  );

  return { attemptId: response.attempt_id };
}
