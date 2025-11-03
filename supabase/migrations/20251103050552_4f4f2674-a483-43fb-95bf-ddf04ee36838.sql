-- إصلاح مشكلة إيقاف الحسابات التلقائي
-- إضافة دالة للتحقق من صلاحية البطاقة وإعادة التفعيل التلقائي

-- دالة لإعادة تفعيل الحسابات التي تم تجديد بطاقاتها
CREATE OR REPLACE FUNCTION public.reactivate_specialists_with_valid_cards()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- إعادة تفعيل المحترفات اللواتي تم تجديد بطاقاتهن
  UPDATE public.specialists
  SET 
    is_active = true,
    suspension_type = NULL,
    suspension_reason = NULL,
    suspension_end_date = NULL
  WHERE 
    is_active = false
    AND suspension_type = 'temporary'
    AND suspension_reason LIKE '%انتهت صلاحية البطاقة%'
    AND id_card_expiry_date IS NOT NULL
    AND id_card_expiry_date >= CURRENT_DATE;
END;
$$;

-- Trigger لإعادة التفعيل التلقائي عند تحديث تاريخ انتهاء البطاقة
CREATE OR REPLACE FUNCTION public.auto_reactivate_on_card_renewal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- إذا تم تحديث تاريخ انتهاء البطاقة إلى تاريخ صالح في المستقبل
  -- وكان الحساب موقوفاً بسبب انتهاء صلاحية البطاقة
  IF NEW.id_card_expiry_date IS NOT NULL 
     AND NEW.id_card_expiry_date >= CURRENT_DATE 
     AND OLD.id_card_expiry_date IS DISTINCT FROM NEW.id_card_expiry_date
     AND NEW.suspension_type = 'temporary'
     AND NEW.suspension_reason LIKE '%انتهت صلاحية البطاقة%'
  THEN
    -- إعادة تفعيل الحساب تلقائياً
    NEW.is_active := true;
    NEW.suspension_type := NULL;
    NEW.suspension_reason := NULL;
    NEW.suspension_end_date := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- إنشاء أو استبدال Trigger
DROP TRIGGER IF EXISTS trigger_auto_reactivate_on_card_renewal ON public.specialists;
CREATE TRIGGER trigger_auto_reactivate_on_card_renewal
  BEFORE UPDATE ON public.specialists
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_reactivate_on_card_renewal();

-- تشغيل الدالة مرة واحدة لإعادة تفعيل أي حسابات موقوفة خطأً
SELECT public.reactivate_specialists_with_valid_cards();