-- إنشاء جدول للعلاقة بين العقود والخدمات الفرعية (many-to-many)
CREATE TABLE IF NOT EXISTS public.contract_sub_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contract_templates(id) ON DELETE CASCADE,
  sub_service_id UUID NOT NULL REFERENCES public.sub_services(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contract_id, sub_service_id)
);

-- Enable RLS
ALTER TABLE public.contract_sub_services ENABLE ROW LEVEL SECURITY;

-- سياسات RLS للجدول الجديد
-- الأدمن يمكنهم رؤية كل شيء
CREATE POLICY "Admins can view all contract sub services"
ON public.contract_sub_services
FOR SELECT
USING (
  is_admin(auth.uid()) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'admin_full'::app_role) OR
  has_role(auth.uid(), 'admin_manager'::app_role) OR
  has_role(auth.uid(), 'admin_viewer'::app_role)
);

-- الشركات يمكنها رؤية خدمات عقودها
CREATE POLICY "Companies can view their contract sub services"
ON public.contract_sub_services
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM contract_templates ct
    JOIN profiles p ON p.company_id = ct.company_id
    WHERE ct.id = contract_sub_services.contract_id
    AND p.user_id = auth.uid()
  )
);

-- الشركات يمكنها إضافة خدمات لعقودها
CREATE POLICY "Companies can insert their contract sub services"
ON public.contract_sub_services
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM contract_templates ct
    JOIN profiles p ON p.company_id = ct.company_id
    WHERE ct.id = contract_sub_services.contract_id
    AND p.user_id = auth.uid()
  )
);

-- الشركات يمكنها حذف خدمات من عقودها المعلقة
CREATE POLICY "Companies can delete their pending contract sub services"
ON public.contract_sub_services
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM contract_templates ct
    JOIN profiles p ON p.company_id = ct.company_id
    WHERE ct.id = contract_sub_services.contract_id
    AND p.user_id = auth.uid()
    AND ct.approval_status = 'pending'
  )
);

-- الأدمن يمكنهم إدارة كل شيء
CREATE POLICY "Admins can manage all contract sub services"
ON public.contract_sub_services
FOR ALL
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

-- نقل البيانات الموجودة من sub_service_id إلى الجدول الجديد
INSERT INTO public.contract_sub_services (contract_id, sub_service_id)
SELECT id, sub_service_id 
FROM public.contract_templates 
WHERE sub_service_id IS NOT NULL
ON CONFLICT (contract_id, sub_service_id) DO NOTHING;

-- إنشاء index لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_contract_sub_services_contract_id ON public.contract_sub_services(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_sub_services_sub_service_id ON public.contract_sub_services(sub_service_id);