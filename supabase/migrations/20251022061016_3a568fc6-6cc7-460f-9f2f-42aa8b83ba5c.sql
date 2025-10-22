-- حذف السياسات القديمة
DROP POLICY IF EXISTS "Admins can delete order specialists" ON public.order_specialists;
DROP POLICY IF EXISTS "Admins and specialists can insert order specialists" ON public.order_specialists;

-- إعادة إنشاء سياسة الإدراج للمسؤولين
CREATE POLICY "Admins can insert order specialists"
ON public.order_specialists
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin(auth.uid())
);

-- إعادة إنشاء سياسة الإدراج للمتخصصين من خلال الشركات
CREATE POLICY "Companies can insert order specialists"
ON public.order_specialists
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id IS NOT NULL
  )
);

-- إعادة إنشاء سياسة الحذف للمسؤولين
CREATE POLICY "Admins can delete order specialists"
ON public.order_specialists
FOR DELETE
TO authenticated
USING (
  public.is_admin(auth.uid())
);