-- Add waiting time column to cancellation_settings table
ALTER TABLE public.cancellation_settings
ADD COLUMN waiting_time_minutes INTEGER NOT NULL DEFAULT 5 CHECK (waiting_time_minutes > 0 AND waiting_time_minutes <= 60);

COMMENT ON COLUMN public.cancellation_settings.waiting_time_minutes IS 'Waiting time in minutes for customer arrival (1-60 minutes)';

-- Update existing records to have default 5 minutes
UPDATE public.cancellation_settings
SET waiting_time_minutes = 5
WHERE waiting_time_minutes IS NULL;