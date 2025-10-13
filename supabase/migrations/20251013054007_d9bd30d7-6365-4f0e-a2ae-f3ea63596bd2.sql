-- إضافة عمود لتحديد وقت انتهاء صلاحية الطلب (3 دقائق)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- تحديث الطلبات الحالية لتعيين وقت الانتهاء بناءً على آخر إرسال أو تاريخ الإنشاء
UPDATE public.orders 
SET expires_at = COALESCE(last_sent_at, created_at) + INTERVAL '3 minutes'
WHERE expires_at IS NULL;

-- إنشاء دالة لتحديث وقت الانتهاء تلقائياً عند تحديث last_sent_at
CREATE OR REPLACE FUNCTION public.update_order_expires_at()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- إنشاء trigger لتحديث expires_at تلقائياً
DROP TRIGGER IF EXISTS update_order_expires_at_trigger ON public.orders;
CREATE TRIGGER update_order_expires_at_trigger
  BEFORE INSERT OR UPDATE OF last_sent_at ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_expires_at();

-- إضافة index لتحسين الأداء عند البحث عن الطلبات النشطة
CREATE INDEX IF NOT EXISTS idx_orders_expires_at ON public.orders(expires_at);