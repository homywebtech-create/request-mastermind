-- Create cron job to fix inconsistent orders every 5 minutes
SELECT cron.schedule(
  'fix-inconsistent-orders',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT CONCAT(current_setting('app.settings.supabase_url'), '/functions/v1/fix-inconsistent-orders')),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', CONCAT('Bearer ', current_setting('app.settings.service_role_key'))
    )
  ) AS request_id;
  $$
);
