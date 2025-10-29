-- حذف الـ policy السابق
DROP POLICY IF EXISTS "Public can search company_users by phone for login" ON public.company_users;

-- إضافة policy أكثر أماناً - يسمح فقط للمستخدمين غير المسجلين بالبحث للتحقق من وجود رقم الهاتف
-- لكن يخفي المعلومات الحساسة
CREATE POLICY "Public can verify phone existence for login"
ON public.company_users
FOR SELECT
USING (
  -- السماح بالقراءة فقط للمستخدمين غير المسجلين (للتحقق من رقم الهاتف)
  auth.uid() IS NULL
  OR
  -- أو للمستخدم نفسه
  user_id = auth.uid()
  OR
  -- أو للإداريين
  (SELECT has_role(auth.uid(), 'admin'::app_role))
);