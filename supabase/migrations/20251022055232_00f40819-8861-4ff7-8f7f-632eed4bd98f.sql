-- تحديث سياسة RLS للسماح للشركات بتحديث عقودها المعتمدة
-- عند التحديث، سيتم إعادة تعيين approval_status إلى pending تلقائياً في الكود

-- حذف السياسة القديمة
DROP POLICY IF EXISTS "Companies can update their pending contracts" ON public.contract_templates;

-- إنشاء سياسة جديدة تسمح بتحديث جميع عقود الشركة (معتمدة أو معلقة)
CREATE POLICY "Companies can update their own contracts"
ON public.contract_templates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = contract_templates.company_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = contract_templates.company_id
  )
);