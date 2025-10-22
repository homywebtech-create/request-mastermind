-- إضافة سياسة UPDATE للأدمن على جدول العقود
-- التحقق من وجود السياسة القديمة وحذفها
DROP POLICY IF EXISTS "Admins can approve contracts" ON public.contract_templates;

-- إنشاء سياسة جديدة للأدمن لتحديث العقود (الموافقة والرفض)
CREATE POLICY "Admins can update contracts"
ON public.contract_templates
FOR UPDATE
USING (
  is_admin(auth.uid()) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'admin_full'::app_role) OR
  has_role(auth.uid(), 'admin_manager'::app_role)
)
WITH CHECK (
  is_admin(auth.uid()) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'admin_full'::app_role) OR
  has_role(auth.uid(), 'admin_manager'::app_role)
);