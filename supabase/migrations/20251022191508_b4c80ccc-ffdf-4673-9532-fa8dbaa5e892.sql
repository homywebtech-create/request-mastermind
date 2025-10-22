-- Drop the cron job since we're going instant
SELECT cron.unschedule('notify-expired-orders-every-minute');

-- Create/replace trigger function that calls edge function immediately when expires_at is set
CREATE OR REPLACE FUNCTION notify_on_expiry_scheduled()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if order has an expiry time and hasn't been notified
  IF NEW.expires_at IS NOT NULL 
     AND NEW.status IN ('pending', 'waiting_quotes')
     AND (NEW.notified_expiry IS NULL OR NEW.notified_expiry = false)
  THEN
    -- Call edge function immediately - it will handle the waiting internally
    PERFORM net.http_post(
      url := 'https://vqmktyspogggcrohdwhg.supabase.co/functions/v1/notify-expired-orders',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxbWt0eXNwb2dnZ2Nyb2hkd2hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNDQxNDcsImV4cCI6MjA3NDkyMDE0N30.FdnQXJQ8eRfMK3u90QSxB-jXTkyVJqeNV-yCAQbJGew"}'::jsonb,
      body := format('{"order_id": "%s", "expires_at": "%s"}', NEW.id, NEW.expires_at)::jsonb
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that fires when expires_at is updated
DROP TRIGGER IF EXISTS trigger_notify_on_expiry ON public.orders;
CREATE TRIGGER trigger_notify_on_expiry
AFTER INSERT OR UPDATE OF expires_at, last_sent_at ON public.orders
FOR EACH ROW
EXECUTE FUNCTION notify_on_expiry_scheduled();