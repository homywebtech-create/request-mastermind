-- إضافة سياسة DELETE للأدمن على جدول العقود
CREATE POLICY "Admins can delete contracts"
ON public.contract_templates
FOR DELETE
USING (
  is_admin(auth.uid()) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'admin_full'::app_role) OR
  has_role(auth.uid(), 'admin_manager'::app_role)
);