-- ==============================================================================
-- Migration: 20260916000003_campaign_enhancements.sql
-- Description: Add structured industry and objective fields to campaigns table
-- ==============================================================================

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS objective TEXT;

-- Create index on deleted_at to support efficient recycle bin filtering
CREATE INDEX IF NOT EXISTS idx_campaigns_deleted_at ON campaigns (business_id, deleted_at);
