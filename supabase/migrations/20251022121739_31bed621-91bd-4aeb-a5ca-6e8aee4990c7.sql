-- Add column to track if expiry notification has been sent
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS notified_expiry BOOLEAN DEFAULT NULL;

-- Create index for efficient querying of expired orders
CREATE INDEX IF NOT EXISTS idx_orders_expiry_notification 
ON public.orders(expires_at, notified_expiry) 
WHERE status IN ('pending', 'waiting_quotes');

-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests from cron
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the notify-expired-orders function to run every minute
SELECT cron.schedule(
  'notify-expired-orders',
  '* * * * *', -- Every minute
  $$
  SELECT
    net.http_post(
        url:='https://vqmktyspogggcrohdwhg.supabase.co/functions/v1/notify-expired-orders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxbWt0eXNwb2dnZ2Nyb2hkd2hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNDQxNDcsImV4cCI6MjA3NDkyMDE0N30.FdnQXJQ8eRfMK3u90QSxB-jXTkyVJqeNV-yCAQbJGew"}'::jsonb
    ) as request_id;
  $$
);

COMMENT ON COLUMN public.orders.notified_expiry IS 'Tracks if specialists have been notified about order expiration';