-- تصحيح الطلبات المؤكدة التي لم يتم تحديث is_accepted فيها

-- تحديث is_accepted للطلبات التي لديها status = 'in-progress' و booking_date موجود
UPDATE order_specialists
SET 
  is_accepted = true,
  rejected_at = NULL,
  rejection_reason = NULL
WHERE order_id IN (
  SELECT id 
  FROM orders 
  WHERE status = 'in-progress' 
    AND booking_date IS NOT NULL 
    AND booking_time IS NOT NULL
    AND specialist_id IS NOT NULL
)
AND specialist_id IN (
  SELECT specialist_id 
  FROM orders 
  WHERE status = 'in-progress' 
    AND booking_date IS NOT NULL
    AND specialist_id IS NOT NULL
)
AND is_accepted IS NULL;