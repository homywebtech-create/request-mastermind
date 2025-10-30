-- إصلاح الطلبات المتضاربة (نفس المتخصص، نفس التاريخ، نفس الوقت)
-- سنحتفظ بأول طلب فقط وننقل الباقي إلى pending

-- 1. إلغاء الطلبات المتضاربة (الاحتفاظ بالأول فقط حسب created_at)
UPDATE orders o1
SET 
  status = 'pending',
  specialist_id = NULL,
  notes = COALESCE(o1.notes || ' | ', '') || 'تم إلغاء الحجز تلقائياً بسبب تضارب في المواعيد'
WHERE o1.status = 'in-progress'
  AND o1.specialist_id IS NOT NULL
  AND o1.booking_date IS NOT NULL
  AND o1.booking_time IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM orders o2
    WHERE o2.id != o1.id
      AND o2.specialist_id = o1.specialist_id
      AND o2.booking_date = o1.booking_date
      AND o2.booking_time = o1.booking_time
      AND o2.status = 'in-progress'
      AND o2.created_at < o1.created_at  -- احتفاظ بالأقدم فقط
  );

-- 2. تحديث order_specialists لإلغاء قبول المحترفات في الطلبات الملغاة
UPDATE order_specialists os
SET 
  is_accepted = NULL,
  rejected_at = NULL,
  rejection_reason = NULL
WHERE EXISTS (
  SELECT 1 FROM orders o
  WHERE o.id = os.order_id
    AND o.status = 'pending'
    AND o.notes LIKE '%تضارب في المواعيد%'
);

-- 3. حذف سجلات specialist_schedules للطلبات الملغاة
DELETE FROM specialist_schedules ss
WHERE EXISTS (
  SELECT 1 FROM orders o
  WHERE o.id = ss.order_id
    AND o.status = 'pending'
    AND o.notes LIKE '%تضارب في المواعيد%'
);