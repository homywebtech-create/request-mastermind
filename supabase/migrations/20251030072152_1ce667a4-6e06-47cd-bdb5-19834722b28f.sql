-- حذف السجلات المرتبطة بالطلب ORD-0006 من order_specialists
DELETE FROM public.order_specialists 
WHERE order_id = '0a9742c8-abef-49af-994a-91bbeba3edcb';

-- حذف الطلب ORD-0006
DELETE FROM public.orders 
WHERE id = '0a9742c8-abef-49af-994a-91bbeba3edcb';