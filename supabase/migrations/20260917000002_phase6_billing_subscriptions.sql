-- PHASE 6: COMMERCIALIZATION, BILLING, SUBSCRIPTIONS & PRODUCTION HARDENING MIGRATION
-- Migration: 20260917000002_phase6_billing_subscriptions.sql

-- 1. PLANS (Stable Plan Identity)
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. PLAN VERSIONS (Immutable Versioned Pricing & Limits)
CREATE TABLE IF NOT EXISTS plan_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    price_paise BIGINT NOT NULL,
    billing_period TEXT NOT NULL CHECK (billing_period IN ('daily', 'weekly', 'monthly', 'yearly')),
    billing_interval INT NOT NULL DEFAULT 1 CHECK (billing_interval >= 1),
    voice_minutes_limit INT NOT NULL DEFAULT 0,
    outbound_calls_limit INT NOT NULL DEFAULT 0,
    contacts_limit INT NOT NULL DEFAULT 0,
    max_active_campaigns INT NOT NULL DEFAULT 1,
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    razorpay_plan_id TEXT,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    effective_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_plan_version UNIQUE (plan_id, version)
);

-- 3. ENHANCE SUBSCRIPTIONS
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id) ON DELETE RESTRICT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_version_id UUID REFERENCES plan_versions(id) ON DELETE RESTRICT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider_status TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT UNIQUE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS razorpay_customer_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS dunning_retries_count INT NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_starts_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_event_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb NOT NULL;

-- Ensure subscriptions status constraint handles all 6 explicit states
DO $$
BEGIN
    ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
        CHECK (status IN ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'EXPIRED'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 4. SUBSCRIPTION HISTORY
CREATE TABLE IF NOT EXISTS subscription_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    reason TEXT NOT NULL,
    event_id UUID REFERENCES webhook_events(id) ON DELETE SET NULL,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. QUOTA RESERVATIONS (Atomic Holds for Live Launches)
CREATE TABLE IF NOT EXISTS quota_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    reserved_calls INT NOT NULL DEFAULT 0,
    reserved_minutes INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'COMMITTED', 'RELEASED', 'EXPIRED')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. PAYMENT RECORDS
CREATE TABLE IF NOT EXISTS payment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    razorpay_payment_id TEXT UNIQUE NOT NULL,
    razorpay_order_id TEXT,
    razorpay_invoice_id TEXT,
    amount_paise BIGINT NOT NULL,
    amount_inr NUMERIC(10, 2) GENERATED ALWAYS AS (amount_paise / 100.0) STORED,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL CHECK (status IN ('created', 'authorized', 'captured', 'failed', 'refunded')),
    method TEXT,
    bank TEXT,
    wallet TEXT,
    vpa TEXT,
    email TEXT,
    contact TEXT,
    error_code TEXT,
    error_description TEXT,
    error_source TEXT,
    error_step TEXT,
    error_reason TEXT,
    reconciled_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. REFUND RECORDS
CREATE TABLE IF NOT EXISTS refund_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payment_records(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    razorpay_refund_id TEXT UNIQUE NOT NULL,
    amount_paise BIGINT NOT NULL,
    amount_inr NUMERIC(10, 2) GENERATED ALWAYS AS (amount_paise / 100.0) STORED,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL CHECK (status IN ('pending', 'processed', 'failed')),
    speed_processed TEXT,
    notes JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. INVOICES (Configurable Tax Calculation Engine)
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES payment_records(id) ON DELETE SET NULL,
    invoice_number TEXT UNIQUE NOT NULL,
    razorpay_invoice_id TEXT UNIQUE,
    subtotal_paise BIGINT NOT NULL,
    tax_type TEXT NOT NULL DEFAULT 'GST',
    tax_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    tax_paise BIGINT NOT NULL DEFAULT 0,
    tax_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    total_paise BIGINT NOT NULL,
    amount_paid_paise BIGINT NOT NULL DEFAULT 0,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    pdf_url TEXT,
    status TEXT NOT NULL CHECK (status IN ('draft', 'issued', 'paid', 'void', 'uncollectible')),
    paid_at TIMESTAMPTZ,
    customer_gstin TEXT,
    billing_address JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. WEBHOOK EVENTS EXTENSIONS
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS provider_event_created_at TIMESTAMPTZ;
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- 10. RATE LIMIT BUCKETS (Deployment-Safe Distributed Token Bucket)
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
    key TEXT PRIMARY KEY,
    tokens NUMERIC NOT NULL,
    last_refill TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- 11. BUSINESSES TAX CONFIGURATION EXTENSIONS
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS gstin TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS billing_state_code TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS is_tax_exempt BOOLEAN DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS tax_exemption_reason TEXT;

-- 12. BILLING AUDIT LOGS
CREATE TABLE IF NOT EXISTS billing_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. INDEXES FOR HIGH-PERFORMANCE QUERYING & RECONCILIATION
CREATE INDEX IF NOT EXISTS idx_plans_slug ON plans(slug);
CREATE INDEX IF NOT EXISTS idx_plan_versions_plan_id ON plan_versions(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_versions_rp_plan_id ON plan_versions(razorpay_plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_business_id ON subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_rp_sub_id ON subscriptions(razorpay_subscription_id);
CREATE INDEX IF NOT EXISTS idx_quota_reservations_business_status ON quota_reservations(business_id, status);
CREATE INDEX IF NOT EXISTS idx_quota_reservations_campaign ON quota_reservations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_business_id ON payment_records(business_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_rp_id ON payment_records(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_business_id ON invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_expires_at ON rate_limit_buckets(expires_at);

-- 14. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE quota_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_audit_logs ENABLE ROW LEVEL SECURITY;

-- Plans: readable by authenticated users
CREATE POLICY plans_select_policy ON plans
    FOR SELECT TO authenticated
    USING (is_active = true);

-- Plan versions: readable by authenticated users
CREATE POLICY plan_versions_select_policy ON plan_versions
    FOR SELECT TO authenticated
    USING (true);

-- Subscriptions history: scoped to business owner
CREATE POLICY subscription_history_business_policy ON subscription_history
    FOR SELECT TO authenticated
    USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- Quota reservations: scoped to business owner
CREATE POLICY quota_reservations_business_policy ON quota_reservations
    FOR ALL TO authenticated
    USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- Payment records: scoped to business owner
CREATE POLICY payment_records_business_policy ON payment_records
    FOR SELECT TO authenticated
    USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- Refund records: scoped to business owner
CREATE POLICY refund_records_business_policy ON refund_records
    FOR SELECT TO authenticated
    USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- Invoices: scoped to business owner
CREATE POLICY invoices_business_policy ON invoices
    FOR SELECT TO authenticated
    USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- Billing audit logs: scoped to business owner
CREATE POLICY billing_audit_logs_business_policy ON billing_audit_logs
    FOR SELECT TO authenticated
    USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- 15. ATOMIC POSTGRESQL RPCS

-- RPC 1: Acquire Campaign Launch Lock & Atomic Quota Reservation
CREATE OR REPLACE FUNCTION acquire_campaign_launch_and_quota(
    p_business_id UUID,
    p_campaign_id UUID,
    p_estimated_calls INT,
    p_estimated_minutes INT
) RETURNS JSONB AS $$
DECLARE
    v_running_count INT;
    v_sub RECORD;
    v_used_minutes INT;
    v_reserved_minutes INT;
    v_total_commitment INT;
    v_reservation_id UUID;
    v_max_minutes INT;
BEGIN
    -- Step 1: Enforce strict V1 Concurrency Invariant: Max 1 RUNNING campaign per business
    SELECT count(*) INTO v_running_count
    FROM campaigns
    WHERE business_id = p_business_id
      AND status = 'RUNNING'
      AND deleted_at IS NULL
    FOR UPDATE;

    IF v_running_count > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'CAMPAIGN_CONCURRENCY_LIMIT_EXCEEDED',
            'message', 'Another campaign is currently RUNNING. Only 1 campaign may run per business concurrently.'
        );
    END IF;

    -- Step 2: Lock and check subscription
    SELECT s.*, pv.voice_minutes_limit, pv.outbound_calls_limit
    INTO v_sub
    FROM subscriptions s
    LEFT JOIN plan_versions pv ON pv.id = s.plan_version_id
    WHERE s.business_id = p_business_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'SUBSCRIPTION_NOT_FOUND',
            'message', 'No subscription found for this business.'
        );
    END IF;

    IF v_sub.status NOT IN ('TRIAL', 'ACTIVE', 'PAST_DUE') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'SUBSCRIPTION_INACTIVE',
            'message', 'Subscription status (' || v_sub.status || ') does not permit launching campaigns.'
        );
    END IF;

    -- Step 3: Quota Calculation
    v_max_minutes := COALESCE(v_sub.voice_minutes_limit, (v_sub.limits->>'voice_minutes')::int, 500);

    -- Calculate current period usage
    SELECT COALESCE(SUM(quantity), 0) INTO v_used_minutes
    FROM usage_events
    WHERE business_id = p_business_id
      AND event_type = 'voice_minutes'
      AND created_at >= v_sub.current_period_start
      AND created_at <= v_sub.current_period_end;

    -- Calculate active reservations
    SELECT COALESCE(SUM(reserved_minutes), 0) INTO v_reserved_minutes
    FROM quota_reservations
    WHERE business_id = p_business_id
      AND status = 'ACTIVE'
      AND expires_at > now();

    v_total_commitment := v_used_minutes + v_reserved_minutes + p_estimated_minutes;

    IF v_max_minutes > 0 AND v_total_commitment > v_max_minutes THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'QUOTA_EXHAUSTED',
            'message', 'Insufficient remaining voice minutes.',
            'remaining_minutes', GREATEST(0, v_max_minutes - (v_used_minutes + v_reserved_minutes)),
            'requested_minutes', p_estimated_minutes
        );
    END IF;

    -- Step 4: Atomic Reservation Creation
    INSERT INTO quota_reservations (
        business_id, campaign_id, subscription_id,
        reserved_calls, reserved_minutes, status, expires_at
    ) VALUES (
        p_business_id, p_campaign_id, v_sub.id,
        p_estimated_calls, p_estimated_minutes, 'ACTIVE', now() + interval '4 hours'
    ) RETURNING id INTO v_reservation_id;

    -- Step 5: Transition Campaign to RUNNING
    UPDATE campaigns
    SET status = 'RUNNING',
        started_at = now(),
        updated_at = now()
    WHERE id = p_campaign_id AND business_id = p_business_id;

    RETURN jsonb_build_object(
        'success', true,
        'reservation_id', v_reservation_id,
        'allocated_minutes', p_estimated_minutes
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC 2: Release / Commit Quota Reservation
CREATE OR REPLACE FUNCTION release_quota_reservation(
    p_reservation_id UUID,
    p_business_id UUID,
    p_commit BOOLEAN DEFAULT true
) RETURNS JSONB AS $$
DECLARE
    v_new_status TEXT;
BEGIN
    IF p_commit THEN
        v_new_status := 'COMMITTED';
    ELSE
        v_new_status := 'RELEASED';
    END IF;

    UPDATE quota_reservations
    SET status = v_new_status,
        updated_at = now()
    WHERE id = p_reservation_id
      AND business_id = p_business_id
      AND status = 'ACTIVE';

    RETURN jsonb_build_object('success', true, 'status', v_new_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC 3: Deployment-Safe Rate Limiter (Sliding Window / Token Bucket)
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_key TEXT,
    p_capacity NUMERIC,
    p_refill_rate NUMERIC,
    p_cost NUMERIC DEFAULT 1
) RETURNS JSONB AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_tokens NUMERIC;
    v_last_refill TIMESTAMPTZ;
    v_elapsed NUMERIC;
    v_new_tokens NUMERIC;
BEGIN
    -- Lock or create bucket
    SELECT tokens, last_refill INTO v_tokens, v_last_refill
    FROM rate_limit_buckets
    WHERE key = p_key
    FOR UPDATE;

    IF NOT FOUND THEN
        v_tokens := p_capacity;
        v_last_refill := v_now;
        INSERT INTO rate_limit_buckets (key, tokens, last_refill, expires_at)
        VALUES (p_key, GREATEST(0, v_tokens - p_cost), v_now, v_now + interval '1 hour');

        RETURN jsonb_build_object(
            'allowed', true,
            'remaining', GREATEST(0, v_tokens - p_cost),
            'retry_after_ms', 0
        );
    END IF;

    -- Calculate replenished tokens
    v_elapsed := EXTRACT(EPOCH FROM (v_now - v_last_refill));
    v_new_tokens := LEAST(p_capacity, v_tokens + (v_elapsed * p_refill_rate));

    IF v_new_tokens >= p_cost THEN
        UPDATE rate_limit_buckets
        SET tokens = v_new_tokens - p_cost,
            last_refill = v_now,
            expires_at = v_now + interval '1 hour'
        WHERE key = p_key;

        RETURN jsonb_build_object(
            'allowed', true,
            'remaining', FLOOR(v_new_tokens - p_cost),
            'retry_after_ms', 0
        );
    ELSE
        RETURN jsonb_build_object(
            'allowed', false,
            'remaining', FLOOR(v_new_tokens),
            'retry_after_ms', CEIL(((p_cost - v_new_tokens) / p_refill_rate) * 1000)
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 16. SEED DEFAULT TEMPLATE PLANS AND IMMUTABLE PLAN VERSIONS
DO $$
DECLARE
    v_starter_id UUID;
    v_growth_id UUID;
    v_enterprise_id UUID;
BEGIN
    -- 1. Starter Plan
    INSERT INTO plans (name, slug, description, is_active)
    VALUES ('Starter', 'starter', 'Ideal for growing Indian businesses launching targeted outbound AI calling.', true)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_starter_id;

    INSERT INTO plan_versions (
        plan_id, version, price_paise, billing_period, billing_interval,
        voice_minutes_limit, outbound_calls_limit, contacts_limit, max_active_campaigns,
        features, razorpay_plan_id
    ) VALUES (
        v_starter_id, 1, 299900, 'monthly', 1,
        500, 2500, 2500, 1,
        '{"indic_voice": true, "csv_export": true, "phone_rotation": false}'::jsonb,
        NULL
    ) ON CONFLICT (plan_id, version) DO NOTHING;

    -- 2. Growth Plan
    INSERT INTO plans (name, slug, description, is_active)
    VALUES ('Growth', 'growth', 'High-volume outbound dialing with bilingual persona and knowledge sources.', true)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_growth_id;

    INSERT INTO plan_versions (
        plan_id, version, price_paise, billing_period, billing_interval,
        voice_minutes_limit, outbound_calls_limit, contacts_limit, max_active_campaigns,
        features, razorpay_plan_id
    ) VALUES (
        v_growth_id, 1, 799900, 'monthly', 1,
        2000, 15000, 15000, 1,
        '{"indic_voice": true, "csv_export": true, "phone_rotation": true, "custom_knowledge": true}'::jsonb,
        NULL
    ) ON CONFLICT (plan_id, version) DO NOTHING;

    -- 3. Enterprise Plan
    INSERT INTO plans (name, slug, description, is_active)
    VALUES ('Enterprise', 'enterprise', 'Large-scale contact centers with dedicated capacity and customized tuning.', true)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_enterprise_id;

    INSERT INTO plan_versions (
        plan_id, version, price_paise, billing_period, billing_interval,
        voice_minutes_limit, outbound_calls_limit, contacts_limit, max_active_campaigns,
        features, razorpay_plan_id
    ) VALUES (
        v_enterprise_id, 1, 1999900, 'monthly', 1,
        10000, 50000, 50000, 1,
        '{"indic_voice": true, "csv_export": true, "phone_rotation": true, "custom_knowledge": true, "priority_support": true}'::jsonb,
        NULL
    ) ON CONFLICT (plan_id, version) DO NOTHING;
END $$;
