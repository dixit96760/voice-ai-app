import {
  CampaignReadinessResult,
  CampaignValidationError,
  PERMITTED_CALLING_END,
  PERMITTED_CALLING_START,
  isWithinPermittedCallingHours,
  toMinutes,
} from "@/lib/validation/campaign";
import type { Campaign, CampaignSource } from "@/lib/campaign/types";

export interface CampaignValidationContext {
  campaign: Campaign;
  sources: CampaignSource[];
  contactCount: number;
  businessId: string;
}

/**
 * Server-side Campaign Readiness Validator
 * Evaluates whether a campaign meets all operational and safety requirements to enter READY state.
 */
export function validateCampaignReadiness(
  context: CampaignValidationContext
): CampaignReadinessResult {
  const { campaign, sources, contactCount, businessId } = context;
  const errors: CampaignValidationError[] = [];

  // 1. Business Ownership Check
  if (campaign.business_id !== businessId) {
    errors.push({
      section: "ownership",
      code: "INVALID_OWNERSHIP",
      message: "Campaign does not belong to the active business context.",
    });
  }

  // 2. Basic Information Check
  if (!campaign.name || campaign.name.trim().length < 2) {
    errors.push({
      section: "basic",
      code: "CAMPAIGN_NAME_REQUIRED",
      message: "Campaign name is required and must be at least 2 characters.",
    });
  }

  if (!campaign.offering_type || campaign.offering_type.trim().length < 2) {
    errors.push({
      section: "basic",
      code: "OFFERING_REQUIRED",
      message: "Offering / product name is required.",
    });
  }

  if (!campaign.description || campaign.description.trim().length < 10) {
    errors.push({
      section: "basic",
      code: "DESCRIPTION_REQUIRED",
      message: "Short description is required (at least 10 characters).",
    });
  }

  // 3. Campaign Knowledge Check
  if (sources.length === 0) {
    errors.push({
      section: "knowledge",
      code: "KNOWLEDGE_REQUIRED",
      message: "Add at least one approved campaign knowledge source.",
    });
  } else {
    // Check whether at least one source has usable content
    const hasUsableSource = sources.some(
      (s) =>
        s.processing_status === "READY" ||
        (s.raw_text && s.raw_text.trim().length >= 10)
    );
    if (!hasUsableSource) {
      errors.push({
        section: "knowledge",
        code: "KNOWLEDGE_NOT_USABLE",
        message:
          "None of the attached knowledge sources are ready or contain approved text.",
      });
    }
  }

  // 4. Contact Assignment Check
  if (contactCount === 0) {
    errors.push({
      section: "contacts",
      code: "CONTACTS_REQUIRED",
      message: "At least one contact must be assigned to this campaign.",
    });
  }

  // 5. Calling Rules Check
  if (!campaign.calling_days || campaign.calling_days.length === 0) {
    errors.push({
      section: "calling",
      code: "CALLING_DAYS_REQUIRED",
      message: "At least one calling day must be selected.",
    });
  }

  if (!campaign.calling_start_time || !campaign.calling_end_time) {
    errors.push({
      section: "calling",
      code: "CALLING_HOURS_REQUIRED",
      message: "Calling start and end times are required.",
    });
  } else {
    const start = campaign.calling_start_time.slice(0, 5);
    const end = campaign.calling_end_time.slice(0, 5);
    if (toMinutes(end) <= toMinutes(start)) {
      errors.push({
        section: "calling",
        code: "INVALID_CALLING_WINDOW",
        message: "Calling end time must be after start time.",
      });
    } else if (!isWithinPermittedCallingHours(start, end)) {
      errors.push({
        section: "calling",
        code: "CALLING_WINDOW_OUTSIDE_PERMITTED_HOURS",
        message: `Calls are only permitted between ${PERMITTED_CALLING_START} and ${PERMITTED_CALLING_END} IST.`,
      });
    }
  }

  if (!campaign.max_attempts || campaign.max_attempts < 1) {
    errors.push({
      section: "calling",
      code: "INVALID_ATTEMPTS",
      message: "Maximum call attempts must be at least 1.",
    });
  }

  if (!campaign.retry_interval_minutes || campaign.retry_interval_minutes < 15) {
    errors.push({
      section: "calling",
      code: "INVALID_RETRY_GAP",
      message: "Retry gap must be at least 15 minutes.",
    });
  }

  return {
    ready: errors.length === 0,
    errors,
  };
}
