-- حذف الجدول القديم وإعادة إنشائه بالهيكل الصحيح
DROP TABLE IF EXISTS public.company_services;

-- إنشاء جدول جديد يربط الشركات بالخدمات والخدمات الفرعية
CREATE TABLE public.company_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  sub_service_id UUID REFERENCES public.sub_services(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, service_id, sub_service_id)
);

-- تفعيل RLS
ALTER TABLE public.company_services ENABLE ROW LEVEL SECURITY;

-- سياسات الوصول
CREATE POLICY "Everyone can view company services"
ON public.company_services
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can manage company services"
ON public.company_services
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- إضافة فهارس
CREATE INDEX idx_company_services_company_id ON public.company_services(company_id);
CREATE INDEX idx_company_services_service_id ON public.company_services(service_id);
CREATE INDEX idx_company_services_sub_service_id ON public.company_services(sub_service_id);

COMMENT ON TABLE public.company_services IS 'يربط الشركات بالخدمات والخدمات الفرعية التي تقدمها';