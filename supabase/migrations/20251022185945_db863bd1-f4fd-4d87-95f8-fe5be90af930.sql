-- Enable required extensions (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Remove the immediate trigger to avoid instant notifications
DROP TRIGGER IF EXISTS notify_on_order_expiry ON public.orders;

-- Unschedule previous job if it exists (ignore errors if not present)
DO $$
BEGIN
  PERFORM cron.unschedule('notify-expired-orders-every-minute');
EXCEPTION WHEN OTHERS THEN
  -- no-op if job doesn't exist yet
  NULL;
END$$;

-- Schedule the notifier to run every minute (approx 60s delay)
SELECT cron.schedule(
  'notify-expired-orders-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vqmktyspogggcrohdwhg.supabase.co/functions/v1/notify-expired-orders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxbWt0eXNwb2dnZ2Nyb2hkd2hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNDQxNDcsImV4cCI6MjA3NDkyMDE0N30.FdnQXJQ8eRfMK3u90QSxB-jXTkyVJqeNV-yCAQbJGew"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  );
  $$
);
