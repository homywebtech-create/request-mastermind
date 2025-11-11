-- حذف السياسة القديمة
DROP POLICY IF EXISTS "Companies can insert customers" ON public.customers;

-- إنشاء سياسة جديدة مبسطة
CREATE POLICY "Companies can insert customers" ON public.customers
FOR INSERT
WITH CHECK (
  -- السماح للمستخدمين المرتبطين بشركة بإنشاء عملاء لشركتهم
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.company_id IS NOT NULL
      AND (
        customers.company_id = profiles.company_id 
        OR customers.company_id IS NULL
      )
  )
  OR
  -- السماح للإداريين بإنشاء أي عملاء
  public.is_admin(auth.uid())
);