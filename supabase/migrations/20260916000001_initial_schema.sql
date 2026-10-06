-- ==============================================================================
-- Migration: 20260916000001_initial_schema.sql
-- Description: Core schema for B2B Voice Calling SaaS (India-first with Sarvam)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. PROFILES & BUSINESSES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    business_type TEXT,
    description TEXT,
    website TEXT,
    business_email TEXT,
    business_phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    country TEXT DEFAULT 'India' NOT NULL,
    timezone TEXT DEFAULT 'Asia/Kolkata' NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_business_owner UNIQUE (owner_id) -- V1: Exactly one business per user
);

CREATE TABLE IF NOT EXISTS phone_numbers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    provider TEXT DEFAULT 'sarvam' NOT NULL,
    provider_connection_id TEXT,
    provider_metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    status TEXT DEFAULT 'ACTIVE' NOT NULL,
    is_default BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_business_phone_number UNIQUE (business_id, phone_number)
);

-- ==============================================================================
-- 2. CAMPAIGNS & KNOWLEDGE SOURCES
-- ==============================================================================

CREATE TYPE campaign_status AS ENUM ('DRAFT', 'READY', 'RUNNING', 'PAUSED', 'COMPLETED');

CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    offering_type TEXT,
    status campaign_status DEFAULT 'DRAFT' NOT NULL,
    active_version_id UUID,
    sarvam_agent_id TEXT,
    sarvam_campaign_id TEXT,
    calling_start_time TIME DEFAULT '10:00:00' NOT NULL,
    calling_end_time TIME DEFAULT '18:30:00' NOT NULL,
    calling_days INTEGER[] DEFAULT '{1,2,3,4,5,6}' NOT NULL, -- Mon-Sat
    timezone TEXT DEFAULT 'Asia/Kolkata' NOT NULL,
    max_attempts INTEGER DEFAULT 3 NOT NULL,
    retry_interval_minutes INTEGER DEFAULT 60 NOT NULL,
    max_call_duration_seconds INTEGER DEFAULT 300 NOT NULL,
    auto_complete BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    paused_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE -- 30-day soft delete / recycle bin
);

-- CRITICAL BUSINESS RULE: Only ONE campaign may be RUNNING per business at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_running_campaign_per_business 
ON campaigns (business_id) 
WHERE (status = 'RUNNING' AND deleted_at IS NULL);

CREATE TYPE campaign_source_type AS ENUM (
    'manual', 'text', 'pdf', 'document', 'website', 'csv', 'excel', 'google_sheet'
);

CREATE TABLE IF NOT EXISTS campaign_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    source_type campaign_source_type NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT,
    storage_path TEXT,
    raw_text TEXT,
    processing_status TEXT DEFAULT 'PENDING' NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS campaign_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    system_instructions TEXT NOT NULL,
    knowledge_snapshot JSONB DEFAULT '{}'::jsonb NOT NULL,
    configuration JSONB DEFAULT '{}'::jsonb NOT NULL,
    sarvam_agent_id TEXT,
    sarvam_agent_version_id TEXT,
    status TEXT DEFAULT 'DRAFT' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_campaign_version UNIQUE (campaign_id, version_number)
);

-- Add foreign key constraint for active_version_id now that campaign_versions exists
ALTER TABLE campaigns
    ADD CONSTRAINT fk_campaign_active_version
    FOREIGN KEY (active_version_id)
    REFERENCES campaign_versions(id)
    ON DELETE SET NULL;

-- ==============================================================================
-- 3. CONTACTS, CAMPAIGN CONTACTS & DNC
-- ==============================================================================

CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    city TEXT,
    status TEXT DEFAULT 'ACTIVE' NOT NULL,
    tags TEXT[] DEFAULT '{}'::text[] NOT NULL,
    notes TEXT,
    custom_fields JSONB DEFAULT '{}'::jsonb NOT NULL,
    is_dnc BOOLEAN DEFAULT false NOT NULL,
    is_wrong_number BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_business_contact_phone UNIQUE (business_id, phone)
);

CREATE TABLE IF NOT EXISTS campaign_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    import_source TEXT,
    import_batch_id UUID,
    status TEXT DEFAULT 'QUEUED' NOT NULL,
    attempt_count INTEGER DEFAULT 0 NOT NULL,
    last_call_at TIMESTAMP WITH TIME ZONE,
    next_call_at TIMESTAMP WITH TIME ZONE,
    custom_variables JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_campaign_contact UNIQUE (campaign_id, contact_id)
);

CREATE TYPE dnc_reason AS ENUM ('customer_requested', 'wrong_number', 'manual', 'other');

CREATE TABLE IF NOT EXISTS dnc_numbers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    reason dnc_reason DEFAULT 'customer_requested' NOT NULL,
    source_call_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_business_dnc_phone UNIQUE (business_id, phone_number)
);

-- ==============================================================================
-- 4. CALLS, ATTEMPTS, TRANSCRIPTS, RECORDINGS & ANALYSIS
-- ==============================================================================

CREATE TYPE call_direction AS ENUM ('OUTBOUND', 'INBOUND');

CREATE TYPE call_status AS ENUM (
    'QUEUED', 'INITIATED', 'RINGING', 'ANSWERED', 'IN_PROGRESS', 
    'COMPLETED', 'FAILED', 'NO_ANSWER', 'BUSY', 'CANCELLED'
);

CREATE TYPE call_outcome AS ENUM (
    'INTERESTED', 'NOT_INTERESTED', 'CALLBACK', 'NO_ANSWER', 
    'BUSY', 'UNREACHABLE', 'WRONG_NUMBER', 'DO_NOT_CALL', 
    'INFORMATION_REQUESTED', 'OTHER'
);

CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    campaign_contact_id UUID REFERENCES campaign_contacts(id) ON DELETE SET NULL,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    direction call_direction DEFAULT 'OUTBOUND' NOT NULL,
    provider TEXT DEFAULT 'sarvam' NOT NULL,
    provider_call_id TEXT,
    provider_interaction_id TEXT,
    status call_status DEFAULT 'QUEUED' NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    answered_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0 NOT NULL,
    outcome call_outcome,
    interest_level TEXT,
    short_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS call_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_contact_id UUID NOT NULL REFERENCES campaign_contacts(id) ON DELETE CASCADE,
    call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
    attempt_number INTEGER NOT NULL,
    provider_call_id TEXT,
    status TEXT NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0 NOT NULL,
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS call_transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    transcript_text TEXT NOT NULL,
    language TEXT DEFAULT 'en-IN',
    provider_transcript_id TEXT,
    storage_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_call_transcript UNIQUE (call_id)
);

CREATE TABLE IF NOT EXISTS call_recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    provider_recording_id TEXT,
    storage_path TEXT NOT NULL,
    duration_seconds INTEGER DEFAULT 0 NOT NULL,
    file_size BIGINT,
    mime_type TEXT DEFAULT 'audio/wav',
    available_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + INTERVAL '45 days') NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_call_recording UNIQUE (call_id)
);

CREATE TABLE IF NOT EXISTS call_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    short_summary TEXT NOT NULL,
    customer_intent TEXT,
    interest_level TEXT,
    questions_asked TEXT[] DEFAULT '{}'::text[] NOT NULL,
    requirements TEXT[] DEFAULT '{}'::text[] NOT NULL,
    objections TEXT[] DEFAULT '{}'::text[] NOT NULL,
    important_information TEXT[] DEFAULT '{}'::text[] NOT NULL,
    requested_follow_up TEXT,
    recommended_next_action TEXT,
    outcome call_outcome,
    analysis_version INTEGER DEFAULT 1 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_call_analysis UNIQUE (call_id)
);

-- ==============================================================================
-- 5. CALLBACKS
-- ==============================================================================

CREATE TYPE callback_status AS ENUM (
    'SCHEDULED', 'QUEUED', 'CALLING', 'COMPLETED', 'CANCELLED', 'MISSED'
);

CREATE TABLE IF NOT EXISTS callbacks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    timezone TEXT DEFAULT 'Asia/Kolkata' NOT NULL,
    status callback_status DEFAULT 'SCHEDULED' NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ==============================================================================
-- 6. WEBHOOK EVENTS, USAGE, SUBSCRIPTIONS & AUDIT LOGS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
    provider TEXT DEFAULT 'sarvam' NOT NULL,
    event_type TEXT NOT NULL,
    provider_event_id TEXT,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT false NOT NULL,
    processing_error TEXT,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Ensure idempotency: identical provider event ID is never duplicated
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_provider_event_id 
ON webhook_events (provider, provider_event_id) 
WHERE (provider_event_id IS NOT NULL);

CREATE TABLE IF NOT EXISTS usage_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL,
    unit TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    plan_name TEXT DEFAULT 'STARTER' NOT NULL,
    status TEXT DEFAULT 'ACTIVE' NOT NULL,
    billing_period TEXT DEFAULT 'MONTHLY' NOT NULL,
    current_period_start TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + INTERVAL '30 days') NOT NULL,
    limits JSONB DEFAULT '{"max_contacts": 5000, "voice_minutes": 500}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_business_subscription UNIQUE (business_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 7. PERFORMANCE INDEXES
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_businesses_owner ON businesses (owner_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_business ON phone_numbers (business_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_business ON campaigns (business_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns (status);
CREATE INDEX IF NOT EXISTS idx_campaign_sources_campaign ON campaign_sources (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_versions_campaign ON campaign_versions (campaign_id);
CREATE INDEX IF NOT EXISTS idx_contacts_business ON contacts (business_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts (phone);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign ON campaign_contacts (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_status ON campaign_contacts (status);
CREATE INDEX IF NOT EXISTS idx_calls_business ON calls (business_id);
CREATE INDEX IF NOT EXISTS idx_calls_campaign ON calls (campaign_id);
CREATE INDEX IF NOT EXISTS idx_calls_contact ON calls (contact_id);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_callbacks_business_scheduled ON callbacks (business_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_callbacks_status ON callbacks (status);
CREATE INDEX IF NOT EXISTS idx_dnc_business_phone ON dnc_numbers (business_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_usage_events_business ON usage_events (business_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_business ON audit_logs (business_id, created_at DESC);

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dnc_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE callbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: Returns the business_id owned by the current authenticated user
CREATE OR REPLACE FUNCTION auth_user_business_id()
RETURNS UUID AS $$
  SELECT id FROM businesses WHERE owner_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Profiles: Users can view and update their own profile
CREATE POLICY profiles_owner_policy ON profiles
  FOR ALL USING (auth.uid() = id);

-- Businesses: Users can view and update their own business
CREATE POLICY businesses_owner_policy ON businesses
  FOR ALL USING (auth.uid() = owner_id);

-- Phone Numbers
CREATE POLICY phone_numbers_business_policy ON phone_numbers
  FOR ALL USING (business_id = auth_user_business_id());

-- Campaigns
CREATE POLICY campaigns_business_policy ON campaigns
  FOR ALL USING (business_id = auth_user_business_id());

-- Campaign Sources
CREATE POLICY campaign_sources_business_policy ON campaign_sources
  FOR ALL USING (campaign_id IN (SELECT id FROM campaigns WHERE business_id = auth_user_business_id()));

-- Campaign Versions
CREATE POLICY campaign_versions_business_policy ON campaign_versions
  FOR ALL USING (campaign_id IN (SELECT id FROM campaigns WHERE business_id = auth_user_business_id()));

-- Contacts
CREATE POLICY contacts_business_policy ON contacts
  FOR ALL USING (business_id = auth_user_business_id());

-- Campaign Contacts
CREATE POLICY campaign_contacts_business_policy ON campaign_contacts
  FOR ALL USING (campaign_id IN (SELECT id FROM campaigns WHERE business_id = auth_user_business_id()));

-- DNC Numbers
CREATE POLICY dnc_numbers_business_policy ON dnc_numbers
  FOR ALL USING (business_id = auth_user_business_id());

-- Calls
CREATE POLICY calls_business_policy ON calls
  FOR ALL USING (business_id = auth_user_business_id());

-- Call Attempts
CREATE POLICY call_attempts_business_policy ON call_attempts
  FOR ALL USING (campaign_contact_id IN (
    SELECT cc.id FROM campaign_contacts cc
    JOIN campaigns c ON cc.campaign_id = c.id
    WHERE c.business_id = auth_user_business_id()
  ));

-- Call Transcripts
CREATE POLICY call_transcripts_business_policy ON call_transcripts
  FOR ALL USING (call_id IN (SELECT id FROM calls WHERE business_id = auth_user_business_id()));

-- Call Recordings
CREATE POLICY call_recordings_business_policy ON call_recordings
  FOR ALL USING (call_id IN (SELECT id FROM calls WHERE business_id = auth_user_business_id()));

-- Call Analysis
CREATE POLICY call_analysis_business_policy ON call_analysis
  FOR ALL USING (call_id IN (SELECT id FROM calls WHERE business_id = auth_user_business_id()));

-- Callbacks
CREATE POLICY callbacks_business_policy ON callbacks
  FOR ALL USING (business_id = auth_user_business_id());

-- Usage Events
CREATE POLICY usage_events_business_policy ON usage_events
  FOR ALL USING (business_id = auth_user_business_id());

-- Subscriptions
CREATE POLICY subscriptions_business_policy ON subscriptions
  FOR ALL USING (business_id = auth_user_business_id());

-- Audit Logs
CREATE POLICY audit_logs_business_policy ON audit_logs
  FOR ALL USING (business_id = auth_user_business_id());

-- Webhook Events: Service role only (no regular user policy)
-- Note: Service role automatically bypasses RLS in Supabase.
