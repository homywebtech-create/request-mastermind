-- السماح للمستخدمين غير المسجلين بالبحث في company_users للتحقق من رقم الهاتف
CREATE POLICY "Public can search company_users by phone for login"
ON public.company_users
FOR SELECT
USING (true);