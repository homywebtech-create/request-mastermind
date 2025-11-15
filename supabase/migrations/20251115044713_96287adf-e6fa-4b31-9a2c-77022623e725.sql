-- إضافة حقل is_urgent لتمييز الطلبات العاجلة/المتأخرة
ALTER TABLE public.orders 
ADD COLUMN is_urgent boolean DEFAULT false;

-- إضافة فهرس لتحسين الأداء
CREATE INDEX idx_orders_is_urgent ON public.orders(is_urgent) WHERE is_urgent = true;

-- إضافة تعليق على العمود
COMMENT ON COLUMN public.orders.is_urgent IS 'يشير إلى أن الطلب عاجل أو تم إعادة إرساله من الطلبات المؤكدة';