-- إصلاح مشكلة search_path للدالة
-- أولاً: إسقاط الـ trigger
DROP TRIGGER IF EXISTS update_order_expires_at_trigger ON public.orders;

-- ثانياً: إعادة إنشاء الدالة مع search_path صحيح
CREATE OR REPLACE FUNCTION public.update_order_expires_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- إذا تم تحديث last_sent_at، قم بتحديث expires_at
  IF NEW.last_sent_at IS DISTINCT FROM OLD.last_sent_at THEN
    NEW.expires_at = NEW.last_sent_at + INTERVAL '3 minutes';
  END IF;
  
  -- إذا كان طلب جديد، استخدم created_at
  IF TG_OP = 'INSERT' AND NEW.last_sent_at IS NULL THEN
    NEW.expires_at = NEW.created_at + INTERVAL '3 minutes';
  END IF;
  
  RETURN NEW;
END;
$$;

-- ثالثاً: إعادة إنشاء الـ trigger
CREATE TRIGGER update_order_expires_at_trigger
  BEFORE INSERT OR UPDATE OF last_sent_at ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_expires_at();