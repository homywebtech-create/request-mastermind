-- إنشاء جدول الخدمات الرئيسية
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- إنشاء جدول الخدمات الفرعية
CREATE TABLE IF NOT EXISTS public.sub_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(service_id, name)
);

-- تفعيل RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_services ENABLE ROW LEVEL SECURITY;

-- سياسات للجميع لمشاهدة الخدمات
CREATE POLICY "Everyone can view services"
ON public.services
FOR SELECT
USING (is_active = true);

CREATE POLICY "Everyone can view sub_services"
ON public.sub_services
FOR SELECT
USING (is_active = true);

-- سياسات للمصادقين لإدارة الخدمات (سنضيف قيود الصلاحيات لاحقاً)
CREATE POLICY "Authenticated users can manage services"
ON public.services
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can manage sub_services"
ON public.sub_services
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- إضافة مؤشرات للأداء
CREATE INDEX idx_sub_services_service_id ON public.sub_services(service_id);

-- إضافة trigger للتحديث التلقائي لـ updated_at
CREATE TRIGGER update_services_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sub_services_updated_at
BEFORE UPDATE ON public.sub_services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- إدراج الخدمات الحالية
INSERT INTO public.services (name) VALUES
  ('نظافة منزلية'),
  ('تنظيف عميق'),
  ('تنظيف السجاد'),
  ('تنظيف الزجاج'),
  ('تنظيف المكاتب'),
  ('خدمات التعقيم'),
  ('خدمات أخرى')
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE public.services IS 'الخدمات الرئيسية';
COMMENT ON TABLE public.sub_services IS 'الخدمات الفرعية التابعة للخدمات الرئيسية';