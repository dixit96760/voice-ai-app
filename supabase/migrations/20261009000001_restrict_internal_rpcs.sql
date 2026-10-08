-- ==============================================================================
-- Migration: 20261009000001_restrict_internal_rpcs.sql
-- Description: Stops signed-in users from calling internal SECURITY DEFINER
--              functions directly through the REST API (/rest/v1/rpc/...).
--
-- The app calls these only from the server with the service role
-- (lib/security/rate-limiter.ts, lib/billing/quota-service.ts), but Supabase's
-- default privileges also granted EXECUTE to `authenticated`, so any account
-- could:
--   * check_rate_limit: drain any rate-limit bucket, e.g. the bucket for
--     Sarvam's call-result webhooks, blocking call results for every business;
--   * release_quota_reservation / acquire_campaign_launch_and_quota: release
--     its own minute holds early and launch beyond its plan's voice minutes.
-- ==============================================================================

REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, NUMERIC, NUMERIC, NUMERIC)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, NUMERIC, NUMERIC, NUMERIC)
    TO service_role;

REVOKE EXECUTE ON FUNCTION public.release_quota_reservation(UUID, UUID, BOOLEAN)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_quota_reservation(UUID, UUID, BOOLEAN)
    TO service_role;

REVOKE EXECUTE ON FUNCTION public.acquire_campaign_launch_and_quota(UUID, UUID, INT, INT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_campaign_launch_and_quota(UUID, UUID, INT, INT)
    TO service_role;
