-- تمكين الإضافات المطلوبة للجدولة
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- جدولة التحقق اليومي من البطاقات المنتهية (يومياً الساعة 1 صباحاً)
SELECT cron.schedule(
  'check-expired-id-cards-daily',
  '0 1 * * *', -- كل يوم الساعة 1:00 صباحاً
  $$
  SELECT
    net.http_post(
        url:='https://vqmktyspogggcrohdwhg.supabase.co/functions/v1/check-expired-cards',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxbWt0eXNwb2dnZ2Nyb2hkd2hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNDQxNDcsImV4cCI6MjA3NDkyMDE0N30.FdnQXJQ8eRfMK3u90QSxB-jXTkyVJqeNV-yCAQbJGew"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- يمكن أيضاً تشغيل الفحص يدوياً في أي وقت باستخدام:
-- SELECT public.check_expired_id_cards();