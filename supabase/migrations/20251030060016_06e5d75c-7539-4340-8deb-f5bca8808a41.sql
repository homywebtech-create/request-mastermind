-- إصلاح مشكلة Function Search Path Mutable

CREATE OR REPLACE FUNCTION check_schedule_conflict()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;