-- ==============================================================================
-- Migration: 20260916000005_phase5_operational_layer.sql
-- Description: Operational layer enhancements: contact_imports table,
--              contacts import linkage, analytics indexes, and tenant RLS
-- ==============================================================================

-- 1. Create contact_imports table
CREATE TABLE IF NOT EXISTS contact_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('CSV', 'EXCEL', 'GOOGLE_SHEETS', 'MANUAL')),
    file_name TEXT NOT NULL,
    storage_path TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    total_rows INT NOT NULL DEFAULT 0,
    imported_count INT NOT NULL DEFAULT 0,
    duplicate_count INT NOT NULL DEFAULT 0,
    dnc_filtered_count INT NOT NULL DEFAULT 0,
    wrong_number_filtered_count INT NOT NULL DEFAULT 0,
    invalid_count INT NOT NULL DEFAULT 0,
    column_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_summary JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- 2. Add import_id and last_contacted_at to contacts
ALTER TABLE contacts
    ADD COLUMN IF NOT EXISTS import_id UUID REFERENCES contact_imports(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;

-- 3. High-throughput & operational indexes
CREATE INDEX IF NOT EXISTS idx_contact_imports_business_created
ON contact_imports (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contacts_business_phone
ON contacts (business_id, phone);

CREATE INDEX IF NOT EXISTS idx_contacts_import_id
ON contacts (import_id)
WHERE (import_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_calls_business_created
ON calls (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calls_campaign_status_outcome
ON calls (campaign_id, status, outcome);

CREATE INDEX IF NOT EXISTS idx_callbacks_business_scheduled
ON callbacks (business_id, status, scheduled_for ASC);

CREATE INDEX IF NOT EXISTS idx_usage_events_business_period
ON usage_events (business_id, event_type, created_at DESC);

-- 4. Enable Row Level Security on contact_imports
ALTER TABLE contact_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage imports for their business"
ON contact_imports
FOR ALL
USING (
    business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
)
WITH CHECK (
    business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
);
