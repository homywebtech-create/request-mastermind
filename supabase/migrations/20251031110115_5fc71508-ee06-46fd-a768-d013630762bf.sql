-- Add country_code column to companies table to restrict specialist phone numbers
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS country_code text DEFAULT '+966';

COMMENT ON COLUMN companies.country_code IS 'Default country code for the company, used to validate specialist phone numbers';