-- Add suspension columns to specialists table
ALTER TABLE public.specialists 
ADD COLUMN IF NOT EXISTS suspension_type text CHECK (suspension_type IN ('temporary', 'permanent')),
ADD COLUMN IF NOT EXISTS suspension_end_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS suspension_reason text;

-- Add comment to explain the columns
COMMENT ON COLUMN public.specialists.suspension_type IS 'Type of suspension: temporary or permanent';
COMMENT ON COLUMN public.specialists.suspension_end_date IS 'End date for temporary suspension';
COMMENT ON COLUMN public.specialists.suspension_reason IS 'Reason for suspension';