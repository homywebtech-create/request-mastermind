-- إضافة validation للتأكد من أن hours_count معقول

-- 1. تصحيح البيانات الخاطئة الموجودة (تحديد القيم الخارجة عن النطاق المعقول إلى 4 ساعات)
UPDATE orders
SET hours_count = '4'
WHERE hours_count IS NOT NULL
  AND (
    CAST(hours_count AS INTEGER) > 24  -- أكثر من 24 ساعة غير معقول
    OR CAST(hours_count AS INTEGER) < 1  -- أقل من ساعة واحدة غير معقول
  );

-- 2. إنشاء دالة للتحقق من صحة hours_count
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
        
        -- التحقق من أن القيمة معقولة (بين 1 و 24 ساعة)
        IF hours_numeric < 1 OR hours_numeric > 24 THEN
          RAISE EXCEPTION 'عدد الساعات يجب أن يكون بين 1 و 24 ساعة'
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

-- 3. إضافة trigger للتحقق من صحة hours_count عند الإدراج أو التحديث
DROP TRIGGER IF EXISTS validate_hours_count_trigger ON orders;
CREATE TRIGGER validate_hours_count_trigger
  BEFORE INSERT OR UPDATE OF hours_count ON orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_hours_count();