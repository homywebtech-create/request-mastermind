-- Add trigger to automatically send push notifications when new version is added
CREATE OR REPLACE FUNCTION notify_app_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify for new versions (not updates to existing versions)
  IF TG_OP = 'INSERT' THEN
    -- Make async HTTP call to edge function to send notifications
    PERFORM net.http_post(
      url := 'https://vqmktyspogggcrohdwhg.supabase.co/functions/v1/notify-app-update',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxbWt0eXNwb2dnZ2Nyb2hkd2hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNDQxNDcsImV4cCI6MjA3NDkyMDE0N30.FdnQXJQ8eRfMK3u90QSxB-jXTkyVJqeNV-yCAQbJGew"}'::jsonb,
      body := format('{"versionId": "%s"}', NEW.id)::jsonb
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on app_versions table
DROP TRIGGER IF EXISTS on_new_app_version ON public.app_versions;
CREATE TRIGGER on_new_app_version
  AFTER INSERT ON public.app_versions
  FOR EACH ROW
  EXECUTE FUNCTION notify_app_update();