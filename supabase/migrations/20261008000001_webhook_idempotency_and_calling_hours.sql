-- ==============================================================================
-- Migration: 20261008000001_webhook_idempotency_and_calling_hours.sql
-- Description: Makes Sarvam call webhooks safe to retry and to receive twice,
--              lets call attempts exist without a campaign_contacts link, and
--              enforces the TRAI 09:00-21:00 IST calling window in the database.
-- ==============================================================================

-- 1. Track when a webhook processor claimed an event, so a crashed claim can be
--    taken over by a later retry instead of blocking the event forever.
ALTER TABLE public.webhook_events
    ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;

-- 2. Calls that cannot be linked to a campaign contact (for example a contact
--    created from the webhook itself) still record their attempt.
ALTER TABLE public.call_attempts
    ALTER COLUMN campaign_contact_id DROP NOT NULL;

-- 3. One call row per provider attempt. A redelivered webhook reuses the row
--    instead of inserting a duplicate call and duplicate billable usage.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.calls
        WHERE provider_attempt_id IS NOT NULL
        GROUP BY provider, provider_attempt_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'calls contains duplicate (provider, provider_attempt_id) rows. '
            'Remove the duplicates (and their usage_events) before applying this migration.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_calls_provider_attempt'
    ) THEN
        ALTER TABLE public.calls
            ADD CONSTRAINT uq_calls_provider_attempt UNIQUE (provider, provider_attempt_id);
    END IF;
END $$;

-- 4. TRAI permits commercial calls only between 09:00 and 21:00 IST.
--    NOT VALID keeps existing rows readable; the application rejects them at
--    launch, and every new or edited campaign must satisfy the rule.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_campaigns_permitted_calling_hours'
    ) THEN
        ALTER TABLE public.campaigns
            ADD CONSTRAINT chk_campaigns_permitted_calling_hours
            CHECK (
                calling_start_time >= TIME '09:00'
                AND calling_end_time <= TIME '21:00'
                AND calling_end_time > calling_start_time
            ) NOT VALID;
    END IF;
END $$;
