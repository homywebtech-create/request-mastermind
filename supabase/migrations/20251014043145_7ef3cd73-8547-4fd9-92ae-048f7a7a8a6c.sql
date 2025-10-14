-- Add pricing_type field to services and sub_services tables
ALTER TABLE public.services 
ADD COLUMN pricing_type text DEFAULT 'hourly';

ALTER TABLE public.sub_services 
ADD COLUMN pricing_type text DEFAULT 'hourly';

-- Add comments to explain the pricing_type field
COMMENT ON COLUMN public.services.pricing_type IS 'Type of pricing: hourly, daily, task, agreement, or other';
COMMENT ON COLUMN public.sub_services.pricing_type IS 'Type of pricing: hourly, daily, task, agreement, or other';

-- Update existing records to have default pricing_type
UPDATE public.services SET pricing_type = 'hourly' WHERE pricing_type IS NULL;
UPDATE public.sub_services SET pricing_type = 'hourly' WHERE pricing_type IS NULL;