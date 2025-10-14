-- Add price fields to services and sub_services tables
ALTER TABLE public.services 
ADD COLUMN price numeric(10,2) DEFAULT NULL;

ALTER TABLE public.sub_services 
ADD COLUMN price numeric(10,2) DEFAULT NULL;

-- Add comments to explain the price fields
COMMENT ON COLUMN public.services.price IS 'Fixed price for the service in SAR. NULL means price is not fixed.';
COMMENT ON COLUMN public.sub_services.price IS 'Fixed price for the sub-service in SAR. NULL means price is not fixed.';