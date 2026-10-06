import { sarvamFetch } from "./client";
import { getCohortVariableAllowList, getSarvamScope, schedulingPath } from "./config";
import { normalizeIndianPhone } from "@/lib/validation/phone";
import {
  SarvamCohortResponse,
  SarvamCohortUser,
  SarvamStreamCohortRequest,
  SarvamStreamCohortResponse,
} from "./types";
import type { Database } from "@/lib/supabase/types";

type Contact = Database["public"]["Tables"]["contacts"]["Row"];

/** Sarvam accepts at most 1,000 users per streaming request. */
const BATCH_SIZE = 1000;

export interface StreamCohortParams {
  sarvamCampaignId: string;
  cohortName: string;
  contacts: Contact[];
  campaignOffering?: string;
  businessName?: string;
  /**
   * Agent variable names to stream. Sarvam rejects cohorts containing
   * variables the agent does not declare, so this is an allow-list.
   */
  appVariables?: string[];
}

export interface StreamCohortResult {
  cohortId: string;
  status: string;
  totalUsers: number;
  validUsers: number;
  rejectedCount: number;
}

/** Cohort names are limited to 50 characters of letters, digits, spaces, - and _ */
function sanitizeCohortName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9 _-]/g, "").trim().slice(0, 50);
  return cleaned || "cohort";
}

/**
 * Maps a contact to the Sarvam cohort user record.
 * Only allow-listed variables are sent, because Sarvam validates
 * `app_variables` against the agent configuration.
 */
export function buildCohortUser(
  contact: Contact,
  context: { businessName?: string; campaignOffering?: string; appVariables: string[] }
): SarvamCohortUser {
  const phone = normalizeIndianPhone(contact.phone);
  if (!phone.isValid || !phone.normalized) {
    throw new Error(`Contact ${contact.id} has an invalid phone number.`);
  }

  const values: Record<string, string> = {
    customer_name: contact.name || "",
    contact_name: contact.name || "",
    city: contact.city || "",
    business_name: context.businessName || "",
    offering_type: context.campaignOffering || "",
  };

  const appVariables: Record<string, string> = {};
  for (const key of context.appVariables) {
    const value = values[key];
    if (value !== undefined) appVariables[key] = value;
  }

  const user: SarvamCohortUser = {
    user_phone_number: phone.normalized,
    user_identifier: contact.id,
  };

  if (Object.keys(appVariables).length > 0) {
    user.app_variables = appVariables;
  }

  return user;
}

/**
 * Streams eligible contacts into a Sarvam campaign in batches of up to 1,000.
 * Endpoint: POST /api/scheduling/v1/orgs/:org_id/workspaces/:workspace_id/campaigns/:campaign_id/cohorts/stream
 *
 * Enforces:
 * - Phone normalization to E.164 (+91XXXXXXXXXX)
 * - DNC / wrong-number / inactive exclusion
 * - Asynchronous processing recognition (poll with getSarvamCohort)
 */
export async function streamSarvamCohort({
  sarvamCampaignId,
  cohortName,
  contacts,
  campaignOffering,
  businessName,
  appVariables,
}: StreamCohortParams): Promise<StreamCohortResult> {
  getSarvamScope();
  const path = schedulingPath(
    `/${encodeURIComponent(sarvamCampaignId)}/cohorts/stream`
  );

  // 1. Filter and normalize contacts
  const allowedVariables = getCohortVariableAllowList(appVariables);
  const validCohortUsers: SarvamCohortUser[] = [];
  let rejectedCount = 0;

  for (const contact of contacts) {
    // Exclude DNC, wrong numbers and inactive contacts
    if (contact.is_dnc || contact.is_wrong_number || contact.status === "INACTIVE") {
      rejectedCount++;
      continue;
    }

    const phoneNorm = normalizeIndianPhone(contact.phone);
    if (!phoneNorm.isValid || !phoneNorm.normalized) {
      rejectedCount++;
      continue;
    }

    validCohortUsers.push(
      buildCohortUser(contact, {
        businessName,
        campaignOffering,
        appVariables: allowedVariables,
      })
    );
  }

  if (validCohortUsers.length === 0) {
    return {
      cohortId: "",
      status: "failed",
      totalUsers: 0,
      validUsers: 0,
      rejectedCount,
    };
  }

  // 2. Batch users in chunks of 1,000 (Sarvam streaming cohort maximum)
  const baseName = sanitizeCohortName(cohortName);
  const batches = Math.ceil(validCohortUsers.length / BATCH_SIZE);
  let lastCohortId = "";
  let lastStatus = "processing";
  let streamedCount = 0;
  let providerRejected = 0;

  for (let i = 0; i < validCohortUsers.length; i += BATCH_SIZE) {
    const chunk = validCohortUsers.slice(i, i + BATCH_SIZE);
    const chunkName =
      batches > 1
        ? sanitizeCohortName(`${baseName.slice(0, 40)} Part ${Math.floor(i / BATCH_SIZE) + 1}`)
        : baseName;

    const payload: SarvamStreamCohortRequest = {
      name: chunkName,
      users: chunk,
    };

    const response = await sarvamFetch<SarvamStreamCohortResponse>(path, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    lastCohortId = response.cohort_id;
    lastStatus = response.status || "processing";
    streamedCount += chunk.length;
    providerRejected += response.result?.rejected_records || 0;
  }

  return {
    cohortId: lastCohortId,
    status: lastStatus,
    totalUsers: validCohortUsers.length,
    validUsers: streamedCount,
    rejectedCount: rejectedCount + providerRejected,
  };
}

/**
 * Reads cohort processing status and record counts.
 * Endpoint: GET /api/scheduling/v1/orgs/:org_id/workspaces/:workspace_id/campaigns/:campaign_id/cohorts/:cohort_id
 */
export async function getSarvamCohort(
  sarvamCampaignId: string,
  cohortId: string
): Promise<SarvamCohortResponse> {
  getSarvamScope();

  return sarvamFetch<SarvamCohortResponse>(
    schedulingPath(
      `/${encodeURIComponent(sarvamCampaignId)}/cohorts/${encodeURIComponent(cohortId)}`
    ),
    { method: "GET", retryTransient: true }
  );
}
