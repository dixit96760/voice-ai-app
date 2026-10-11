-- ==============================================================================
-- Migration: 20261011000001_default_calling_days_all_week.sql
-- Description: New campaigns may call on every day of the week, Sunday
--              included (1 = Monday ... 7 = Sunday). Existing campaigns keep
--              the days they were saved with.
-- ==============================================================================

ALTER TABLE public.campaigns
    ALTER COLUMN calling_days SET DEFAULT '{1,2,3,4,5,6,7}';
