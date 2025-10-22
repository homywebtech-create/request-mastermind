-- Drop the existing trigger that relies on setTimeout
DROP TRIGGER IF EXISTS trigger_notify_on_expiry ON public.orders;
DROP FUNCTION IF EXISTS public.notify_on_expiry_scheduled();

-- Create a cron job that checks every minute for expired orders
SELECT cron.schedule(
  'check-expired-orders-every-minute',
  '* * * * *', -- Every minute
  $$
  SELECT
    net.http_post(
        url := 'https://vqmktyspogggcrohdwhg.supabase.co/functions/v1/notify-expired-orders',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxbWt0eXNwb2dnZ2Nyb2hkd2hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNDQxNDcsImV4cCI6MjA3NDkyMDE0N30.FdnQXJQ8eRfMK3u90QSxB-jXTkyVJqeNV-yCAQbJGew"}'::jsonb,
        body := '{}'::jsonb
    ) as request_id;
  $$
);