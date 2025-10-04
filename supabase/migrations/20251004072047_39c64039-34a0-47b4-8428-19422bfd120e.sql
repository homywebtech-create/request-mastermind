-- إنشاء جدول لربط الشركات بالخدمات التي تقدمها
CREATE TABLE IF NOT EXISTS public.company_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, service_type)
);

-- تفعيل RLS على الجدول
ALTER TABLE public.company_services ENABLE ROW LEVEL SECURITY;

-- السماح للإداريين بإدارة خدمات الشركات
CREATE POLICY "Admins can manage company services"
ON public.company_services
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- السماح للجميع بمشاهدة خدمات الشركات
CREATE POLICY "Everyone can view company services"
ON public.company_services
FOR SELECT
USING (true);

-- إضافة فهرس لتحسين الأداء
CREATE INDEX idx_company_services_company_id ON public.company_services(company_id);
CREATE INDEX idx_company_services_service_type ON public.company_services(service_type);

COMMENT ON TABLE public.company_services IS 'يربط الشركات بالخدمات التي تقدمها';
COMMENT ON COLUMN public.company_services.service_type IS 'نوع الخدمة التي تقدمها الشركة';