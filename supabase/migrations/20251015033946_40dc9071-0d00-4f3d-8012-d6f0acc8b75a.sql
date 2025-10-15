-- إضافة حقول جديدة لجدول المحترفات
ALTER TABLE public.specialists
ADD COLUMN IF NOT EXISTS countries_worked_in text[], -- الدول التي عملت فيها
ADD COLUMN IF NOT EXISTS face_photo_url text, -- صورة الوجه
ADD COLUMN IF NOT EXISTS full_body_photo_url text, -- صورة كاملة
ADD COLUMN IF NOT EXISTS id_card_front_url text, -- صورة البطاقة الأمامية
ADD COLUMN IF NOT EXISTS id_card_back_url text, -- صورة البطاقة الخلفية
ADD COLUMN IF NOT EXISTS id_card_expiry_date date, -- تاريخ انتهاء البطاقة
ADD COLUMN IF NOT EXISTS has_cleaning_allergy boolean DEFAULT false, -- حساسية ضد مواد التنظيف
ADD COLUMN IF NOT EXISTS has_pet_allergy boolean DEFAULT false, -- حساسية تجاه الحيوانات
ADD COLUMN IF NOT EXISTS languages_spoken text[]; -- اللغات التي تتحدثها

-- إنشاء دالة للتحقق من انتهاء البطاقات وإيقاف الحسابات تلقائياً
CREATE OR REPLACE FUNCTION public.check_expired_id_cards()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- إيقاف المحترفات اللواتي انتهت بطاقاتهن
  UPDATE public.specialists
  SET 
    is_active = false,
    suspension_type = 'temporary',
    suspension_reason = 'انتهت صلاحية البطاقة الشخصية',
    suspension_end_date = NULL
  WHERE 
    id_card_expiry_date IS NOT NULL
    AND id_card_expiry_date < CURRENT_DATE
    AND is_active = true
    AND (suspension_reason IS NULL OR suspension_reason != 'انتهت صلاحية البطاقة الشخصية');
END;
$$;

-- إنشاء جدول زمني لتشغيل الدالة يومياً (يتطلب تفعيل pg_cron في Supabase)
-- ملاحظة: سيتم تشغيل هذا يومياً في الساعة 1 صباحاً
COMMENT ON FUNCTION public.check_expired_id_cards() IS 'Automatically suspends specialists with expired ID cards';

-- إنشاء bucket جديد لصور البطاقات الشخصية
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'id-cards',
  'id-cards',
  false, -- خاص للحماية
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- سياسات RLS لصور البطاقات
CREATE POLICY "المحترفات يمكنهن رفع بطاقاتهن الشخصية"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'id-cards' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "المشرفون يمكنهم عرض جميع البطاقات"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'id-cards' 
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'admin_full'::app_role)
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY "المحترفات يمكنهن تحديث بطاقاتهن"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'id-cards' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "المحترفات يمكنهن حذف بطاقاتهن"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'id-cards' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);