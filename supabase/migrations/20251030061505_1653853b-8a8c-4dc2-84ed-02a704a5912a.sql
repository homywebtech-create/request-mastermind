-- تعديل نطاق hours_count ليكون من 1 إلى 12 ساعة فقط

-- 1. تصحيح البيانات الموجودة التي تزيد عن 12 ساعة
UPDATE orders
SET hours_count = '12'
WHERE hours_count IS NOT NULL
  AND CAST(hours_count AS INTEGER) > 12;

-- 2. تحديث دالة التحقق من صحة hours_count
CREATE OR REPLACE FUNCTION validate_hours_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.hours_count IS NOT NULL THEN
    -- محاولة تحويل النص إلى رقم
    BEGIN
      DECLARE
        hours_numeric INTEGER;
      BEGIN
        hours_numeric := CAST(NEW.hours_count AS INTEGER);
        
        -- التحقق من أن القيمة معقولة (بين 1 و 12 ساعة فقط)
        IF hours_numeric < 1 OR hours_numeric > 12 THEN
          RAISE EXCEPTION 'عدد الساعات يجب أن يكون بين 1 و 12 ساعة'
            USING ERRCODE = '23514'; -- check_violation
        END IF;
      EXCEPTION 
        WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'قيمة hours_count غير صحيحة: يجب أن تكون رقماً'
            USING ERRCODE = '23514';
      END;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;