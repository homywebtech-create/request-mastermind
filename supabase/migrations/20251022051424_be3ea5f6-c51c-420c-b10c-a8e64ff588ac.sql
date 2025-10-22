-- تحديث سياسة RLS للأدمن لعرض جميع العقود
DROP POLICY IF EXISTS "Admins can view all contracts" ON public.contract_templates;

CREATE POLICY "Admins can view all contracts"
ON public.contract_templates
FOR SELECT
USING (
  is_admin(auth.uid()) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'admin_full'::app_role) OR
  has_role(auth.uid(), 'admin_manager'::app_role) OR
  has_role(auth.uid(), 'admin_viewer'::app_role)
);