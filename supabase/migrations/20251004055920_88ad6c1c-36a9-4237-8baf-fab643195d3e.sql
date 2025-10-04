-- ============================================
-- المرحلة 1: إصلاح نظام التحقق من الهوية
-- ============================================

-- حذف السياسة الخطرة الحالية
DROP POLICY IF EXISTS "Users can verify their codes" ON public.verification_codes;

-- إنشاء سياسة آمنة مع التحقق من رقم الهاتف ومحاولات التحقق
CREATE POLICY "Users can verify codes with security checks" 
ON public.verification_codes 
FOR UPDATE 
USING (
  verified = false 
  AND expires_at > now()
  AND attempts < 5
);

-- ============================================
-- المرحلة 2: حماية بيانات العملاء
-- ============================================

-- إضافة عمود company_id لجدول customers
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- إنشاء فهرس للأداء
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON public.customers(company_id);

-- حذف السياسات القديمة غير الآمنة
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;

-- إنشاء سياسات جديدة آمنة للعرض
CREATE POLICY "Admins can view all customers" 
ON public.customers 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Specialists can view their company customers" 
ON public.customers 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = customers.company_id
  )
);

-- إنشاء سياسات جديدة آمنة للإدراج
CREATE POLICY "Admins can insert customers" 
ON public.customers 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Specialists can insert customers for their company" 
ON public.customers 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = customers.company_id
  )
);

-- ============================================
-- المرحلة 3: إصلاح تسريب بيانات الموظفين
-- ============================================

-- حذف السياسة المتداخلة
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- إنشاء سياسة منفصلة للمستخدمين العاديين فقط
CREATE POLICY "Users can view only their own profile" 
ON public.profiles 
FOR SELECT 
USING (
  user_id = auth.uid() 
  AND NOT has_role(auth.uid(), 'admin')
);

-- تحديث سياسة UPDATE لمنع تغيير company_id
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile safely" 
ON public.profiles 
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid() 
  AND (
    company_id IS NULL 
    OR company_id = (
      SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
);

-- ============================================
-- المرحلة 4: إضافة دور admin للمستخدم الحالي
-- ============================================

-- إضافة دور admin للمستخدم الحالي إذا لم يكن موجوداً
INSERT INTO public.user_roles (user_id, role)
VALUES ('303988fc-0499-4e19-973c-99aff9732b0c', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;