-- إضافة عمود company_logo_url إلى جدول contract_templates
ALTER TABLE public.contract_templates
ADD COLUMN IF NOT EXISTS company_logo_url text;