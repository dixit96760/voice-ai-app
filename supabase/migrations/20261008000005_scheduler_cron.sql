-- ==============================================================================
-- Migration: 20261008000005_scheduler_cron.sql
-- Description: Calls the app's /api/cron/tick every 5 minutes (complete
--              finished campaigns, redial due callbacks, empty the recycle bin).
--
-- Requires two Vault secrets, created outside version control:
--   select vault.create_secret('<same value as CRON_SECRET in Vercel>', 'cron_secret');
--   select vault.create_secret('https://<production-domain>/api/cron/tick', 'cron_tick_url');
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'app-scheduler-tick') THEN
        PERFORM cron.unschedule('app-scheduler-tick');
    END IF;
END $$;

SELECT cron.schedule(
    'app-scheduler-tick',
    '*/5 * * * *',
    $job$
    SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_tick_url'),
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret'),
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 55000
    )
    WHERE EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_secret')
      AND EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_tick_url');
    $job$
);
