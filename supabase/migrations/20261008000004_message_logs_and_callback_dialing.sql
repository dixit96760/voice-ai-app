-- ==============================================================================
-- Migration: 20261008000004_message_logs_and_callback_dialing.sql
-- Description: Records messages sent to contacts (business details over
--              WhatsApp, requested by the voice agent mid-call) and tracks the
--              automatic redial of scheduled callbacks.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.message_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    channel TEXT NOT NULL DEFAULT 'whatsapp',
    purpose TEXT NOT NULL DEFAULT 'business_details',
    recipient TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'not_configured', 'skipped')),
    provider_message_id TEXT,
    error TEXT,
    requested_via TEXT NOT NULL DEFAULT 'agent_tool',
    provider_interaction_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_logs_business_created
    ON public.message_logs (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_logs_contact_campaign
    ON public.message_logs (contact_id, campaign_id, created_at DESC);

ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;

-- Members can see their business's messages; only the server writes them.
DROP POLICY IF EXISTS message_logs_member_read ON public.message_logs;
CREATE POLICY message_logs_member_read ON public.message_logs
    FOR SELECT TO authenticated
    USING (public.auth_user_can_read_business(business_id));

REVOKE ALL ON TABLE public.message_logs FROM anon;
GRANT SELECT ON TABLE public.message_logs TO authenticated;
GRANT ALL ON TABLE public.message_logs TO service_role;

-- Callback redial tracking: the provider attempt that dialled it and how many
-- times it was tried, so the scheduler dials each callback at most once.
ALTER TABLE public.callbacks
    ADD COLUMN IF NOT EXISTS provider_attempt_id TEXT,
    ADD COLUMN IF NOT EXISTS dial_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_dialed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_callbacks_due
    ON public.callbacks (scheduled_for)
    WHERE status = 'SCHEDULED';
