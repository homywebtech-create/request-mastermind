-- Drop the existing cron job
SELECT cron.unschedule('notify-expired-orders');

-- Create a function to check and notify expired orders via pg_net
CREATE OR REPLACE FUNCTION check_and_notify_expired_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if order just expired and hasn't been notified
  IF NEW.expires_at <= NOW() 
     AND NEW.status IN ('pending', 'waiting_quotes')
     AND NEW.notified_expiry IS NULL 
     THEN
    
    -- Make async HTTP call to edge function
    PERFORM net.http_post(
      url := 'https://vqmktyspogggcrohdwhg.supabase.co/functions/v1/notify-expired-orders',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxbWt0eXNwb2dnZ2Nyb2hkd2hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNDQxNDcsImV4cCI6MjA3NDkyMDE0N30.FdnQXJQ8eRfMK3u90QSxB-jXTkyVJqeNV-yCAQbJGew"}'::jsonb,
      body := format('{"order_id": "%s"}', NEW.id)::jsonb
    );
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that fires on INSERT and UPDATE
DROP TRIGGER IF EXISTS trigger_notify_expired_orders ON public.orders;
CREATE TRIGGER trigger_notify_expired_orders
  AFTER INSERT OR UPDATE OF expires_at, status
  ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION check_and_notify_expired_order();

COMMENT ON FUNCTION check_and_notify_expired_order() IS 'Instantly notifies specialists when an order expires using pg_net async HTTP call';