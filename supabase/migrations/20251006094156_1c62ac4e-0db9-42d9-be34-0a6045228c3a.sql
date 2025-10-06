-- Add English name columns to services and sub_services tables
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS name_en TEXT;

ALTER TABLE public.sub_services
ADD COLUMN IF NOT EXISTS name_en TEXT;

-- Add some default English translations for existing services
UPDATE public.services SET name_en = 'General Cleaning Service' WHERE name = 'خدمة النظافة العامة';
UPDATE public.services SET name_en = 'Construction Services' WHERE name = 'خدمات البناء';
UPDATE public.services SET name_en = 'Maintenance Services' WHERE name = 'خدمات الصيانة';
UPDATE public.services SET name_en = 'Transportation Services' WHERE name = 'خدمات النقل';
UPDATE public.services SET name_en = 'Food Services' WHERE name = 'خدمات الطعام';