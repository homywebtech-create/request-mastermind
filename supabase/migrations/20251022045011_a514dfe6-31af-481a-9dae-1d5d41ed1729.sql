-- إضافة حقل company_id وحقول الموافقة إلى جدول contract_templates
ALTER TABLE public.contract_templates 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- تحديث RLS policies للعقود

-- السماح للشركات بإنشاء عقودها الخاصة
DROP POLICY IF EXISTS "Companies can create their own contracts" ON public.contract_templates;
CREATE POLICY "Companies can create their own contracts"
ON public.contract_templates
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() 
    AND company_id = contract_templates.company_id
  )
);

-- السماح للشركات بتعديل عقودها غير المعتمدة
DROP POLICY IF EXISTS "Companies can update their pending contracts" ON public.contract_templates;
CREATE POLICY "Companies can update their pending contracts"
ON public.contract_templates
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() 
    AND company_id = contract_templates.company_id
  )
  AND approval_status = 'pending'
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() 
    AND company_id = contract_templates.company_id
  )
);

-- السماح للشركات بحذف عقودها غير المعتمدة
DROP POLICY IF EXISTS "Companies can delete their pending contracts" ON public.contract_templates;
CREATE POLICY "Companies can delete their pending contracts"
ON public.contract_templates
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() 
    AND company_id = contract_templates.company_id
  )
  AND approval_status = 'pending'
);

-- السماح للشركات برؤية عقودها الخاصة
DROP POLICY IF EXISTS "Companies can view their own contracts" ON public.contract_templates;
CREATE POLICY "Companies can view their own contracts"
ON public.contract_templates
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() 
    AND company_id = contract_templates.company_id
  )
);

-- تحديث policy الأدمن ليرى جميع العقود
DROP POLICY IF EXISTS "Admins can manage contract templates" ON public.contract_templates;
CREATE POLICY "Admins can view all contracts"
ON public.contract_templates
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- السماح للأدمن بتحديث حالة الموافقة فقط
DROP POLICY IF EXISTS "Admins can approve contracts" ON public.contract_templates;
CREATE POLICY "Admins can approve contracts"
ON public.contract_templates
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- تحديث policy العرض العام لتظهر فقط العقود المعتمدة والنشطة
DROP POLICY IF EXISTS "Everyone can view active templates" ON public.contract_templates;
CREATE POLICY "Public can view approved active contracts"
ON public.contract_templates
FOR SELECT
TO public
USING (is_active = true AND approval_status = 'approved');

-- إنشاء index للأداء
CREATE INDEX IF NOT EXISTS idx_contract_templates_company_id ON public.contract_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_contract_templates_approval_status ON public.contract_templates(approval_status);

COMMENT ON COLUMN public.contract_templates.company_id IS 'الشركة المالكة للعقد';
COMMENT ON COLUMN public.contract_templates.approval_status IS 'حالة الموافقة: pending, approved, rejected';
COMMENT ON COLUMN public.contract_templates.approved_by IS 'المستخدم الذي وافق على العقد';
COMMENT ON COLUMN public.contract_templates.approved_at IS 'تاريخ الموافقة';
COMMENT ON COLUMN public.contract_templates.rejection_reason IS 'سبب الرفض (إن وجد)';