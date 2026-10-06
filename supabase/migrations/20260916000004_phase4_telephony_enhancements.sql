-- ==============================================================================
-- Migration: 20260916000004_phase4_telephony_enhancements.sql
-- Description: Telephony execution, provider attempt tracking, phone rotation,
--              and Indic transcript enhancements for Phase 4 Sarvam Voice Agents
-- ==============================================================================

-- 1. Add sarvam_cohort_id and enable_phone_rotation to campaigns
ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS sarvam_cohort_id TEXT,
    ADD COLUMN IF NOT EXISTS enable_phone_rotation BOOLEAN DEFAULT false NOT NULL;

-- 2. Add provider_attempt_id to calls and call_attempts
ALTER TABLE calls
    ADD COLUMN IF NOT EXISTS provider_attempt_id TEXT,
    ADD COLUMN IF NOT EXISTS provider_campaign_id TEXT;

ALTER TABLE call_attempts
    ADD COLUMN IF NOT EXISTS provider_attempt_id TEXT,
    ADD COLUMN IF NOT EXISTS retry_metadata JSONB DEFAULT '{}'::jsonb NOT NULL;

-- 3. Add transcript_json to call_transcripts for Indic + English transcripts preservation
ALTER TABLE call_transcripts
    ADD COLUMN IF NOT EXISTS transcript_json JSONB DEFAULT '[]'::jsonb NOT NULL;

-- 4. Create high-throughput lookup indexes for webhook processing
CREATE INDEX IF NOT EXISTS idx_calls_provider_attempt_id 
ON calls (provider_attempt_id) 
WHERE (provider_attempt_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_calls_provider_interaction_id 
ON calls (provider_interaction_id) 
WHERE (provider_interaction_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_call_attempts_provider_attempt_id 
ON call_attempts (provider_attempt_id) 
WHERE (provider_attempt_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_campaigns_sarvam_campaign_id 
ON campaigns (sarvam_campaign_id) 
WHERE (sarvam_campaign_id IS NOT NULL);
