-- تحديث سياسات RLS لجدول contract_sub_services للسماح بتحديث الخدمات الفرعية للعقود المعتمدة

-- حذف السياسة القديمة للحذف
DROP POLICY IF EXISTS "Companies can delete their pending contract sub services" ON public.contract_sub_services;

-- إنشاء سياسة جديدة للحذف بدون شرط pending
CREATE POLICY "Companies can delete their contract sub services"
ON public.contract_sub_services
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM contract_templates ct
    JOIN profiles p ON p.company_id = ct.company_id
    WHERE ct.id = contract_sub_services.contract_id
    AND p.user_id = auth.uid()
  )
);