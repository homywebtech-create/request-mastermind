-- Add preferred_language column to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(2) DEFAULT 'ar' CHECK (preferred_language IN ('ar', 'en'));

COMMENT ON COLUMN public.customers.preferred_language IS 'Customer preferred language for WhatsApp messages (ar or en)';