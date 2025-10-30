-- إضافة قيود على مستوى قاعدة البيانات لمنع الحجوزات المتعارضة

-- أولاً: إضافة قيد فريد لمنع تكرار نفس الطلب للمحترفة
-- (في حالة محاولة إنشاء نفس الحجز مرتين عن طريق الخطأ)
CREATE UNIQUE INDEX IF NOT EXISTS unique_specialist_order 
ON specialist_schedules(specialist_id, order_id);

-- ثانياً: إضافة دالة للتحقق من التعارضات قبل الإدراج
CREATE OR REPLACE FUNCTION check_schedule_conflict()
RETURNS TRIGGER AS $$
DECLARE
  conflict_count INTEGER;
BEGIN
  -- التحقق من وجود تعارض مع الحجوزات الموجودة
  SELECT COUNT(*)
  INTO conflict_count
  FROM specialist_schedules
  WHERE specialist_id = NEW.specialist_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (
      -- التداخل المباشر بين الأوقات
      tstzrange(start_time, end_time, '[)') && tstzrange(NEW.start_time, NEW.end_time, '[)')
      OR
      -- التداخل مع وقت السفر بعد الحجز الموجود (buffer time)
      (
        NEW.start_time >= end_time 
        AND NEW.start_time < (end_time + (travel_buffer_minutes * INTERVAL '1 minute'))
      )
      OR
      -- التداخل مع وقت السفر قبل الحجز الموجود (buffer time)
      (
        NEW.end_time > (start_time - (COALESCE(NEW.travel_buffer_minutes, 120) * INTERVAL '1 minute'))
        AND NEW.end_time <= start_time
      )
    );
  
  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'المحترفة غير متاحة في هذا الوقت - يوجد حجز متعارض'
      USING ERRCODE = '23P01', -- exclusion_violation
            HINT = 'يرجى اختيار وقت أو محترفة أخرى';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ثالثاً: إضافة trigger للتحقق قبل الإدراج أو التحديث
DROP TRIGGER IF EXISTS validate_schedule_before_insert ON specialist_schedules;
CREATE TRIGGER validate_schedule_before_insert
  BEFORE INSERT OR UPDATE ON specialist_schedules
  FOR EACH ROW
  EXECUTE FUNCTION check_schedule_conflict();

-- رابعاً: إضافة indexes لتحسين أداء الاستعلامات
CREATE INDEX IF NOT EXISTS idx_specialist_schedules_times 
ON specialist_schedules(specialist_id, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_specialist_schedules_order 
ON specialist_schedules(order_id);

-- خامساً: إضافة index للبحث السريع عن التعارضات باستخدام GIST
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE INDEX IF NOT EXISTS idx_specialist_time_range 
ON specialist_schedules USING gist(specialist_id, tstzrange(start_time, end_time, '[)'));