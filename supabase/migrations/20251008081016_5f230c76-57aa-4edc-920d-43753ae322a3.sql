-- إزالة السياسة القديمة المقيدة
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;

-- السماح للإدمنز بإنشاء عملاء
CREATE POLICY "Admins can insert customers"
ON public.customers
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- السماح للجميع (حتى الزوار) بإنشاء عملاء جدد طالما يوفرون رقم هاتف
CREATE POLICY "Anyone can insert customers with phone"
ON public.customers
FOR INSERT
WITH CHECK (whatsapp_number IS NOT NULL AND whatsapp_number != '');