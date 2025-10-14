-- حذف السياسة التي تسمح للجميع بعرض كل الطلبات
DROP POLICY IF EXISTS "Public can view orders" ON public.orders;

-- إضافة سياسة للشركات لعرض طلباتها فقط
CREATE POLICY "Companies can view their own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.company_id IS NOT NULL
      AND profiles.company_id = orders.company_id
  )
);

-- حذف السياسة التي تسمح للجميع بتحديث معلومات الحجز
DROP POLICY IF EXISTS "Public can update order booking info" ON public.orders;

-- إضافة سياسة للعملاء لتحديث معلومات الحجز فقط
CREATE POLICY "Customers can update order booking info"
ON public.orders
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (
  -- Allow updating only booking-related fields
  (booking_date IS DISTINCT FROM (SELECT booking_date FROM public.orders WHERE id = orders.id) OR
   booking_time IS DISTINCT FROM (SELECT booking_time FROM public.orders WHERE id = orders.id) OR
   booking_type IS DISTINCT FROM (SELECT booking_type FROM public.orders WHERE id = orders.id) OR
   gps_latitude IS DISTINCT FROM (SELECT gps_latitude FROM public.orders WHERE id = orders.id) OR
   gps_longitude IS DISTINCT FROM (SELECT gps_longitude FROM public.orders WHERE id = orders.id))
);