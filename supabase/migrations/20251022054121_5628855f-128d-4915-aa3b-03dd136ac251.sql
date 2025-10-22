-- إضافة سياسة للسماح للعامة بالبحث عن المحترفات النشطة لتسجيل الدخول
-- هذه السياسة ضرورية للسماح بالبحث عن رقم الهاتف قبل تسجيل الدخول
CREATE POLICY "Public can view active approved specialists for login"
ON public.specialists
FOR SELECT
USING (
  is_active = true 
  AND approval_status = 'approved'
);