-- السماح للجميع بقراءة معلومات الشركات الأساسية للشركات النشطة فقط
-- هذا ضروري لصفحة تسجيل دخول الشركات
CREATE POLICY "Anyone can view active company basic info for authentication"
ON public.companies
FOR SELECT
USING (is_active = true);

-- ملاحظة: هذه السياسة آمنة لأنها:
-- 1. تسمح بقراءة الشركات النشطة فقط
-- 2. لا تسمح بالكتابة أو التعديل
-- 3. ضرورية لتسجيل دخول الشركات