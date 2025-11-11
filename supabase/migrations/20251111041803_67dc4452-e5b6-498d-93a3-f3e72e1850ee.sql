-- Add cleaning_equipment_required column to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS cleaning_equipment_required boolean DEFAULT NULL;

COMMENT ON COLUMN public.orders.cleaning_equipment_required IS 'Whether cleaning service requires equipment (NULL for non-cleaning services)';