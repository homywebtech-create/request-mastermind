-- حذف جميع سياسات INSERT الحالية على customers
DROP POLICY IF EXISTS "Admins can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Anyone can insert customers with phone" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;

-- إضافة سياسة واحدة بسيطة تسمح للجميع بإدراج عملاء
CREATE POLICY "Allow all customer inserts"
ON public.customers
FOR INSERT
WITH CHECK (whatsapp_number IS NOT NULL AND whatsapp_number != '');