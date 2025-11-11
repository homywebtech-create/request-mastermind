-- Add readiness reminder tracking columns
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS readiness_reminder_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS readiness_last_reminder_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS readiness_penalty_percentage NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS movement_reminder_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS movement_last_reminder_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS specialist_penalty_amount NUMERIC(10,2) DEFAULT 0;

-- Add index for reminder queries
CREATE INDEX IF NOT EXISTS idx_orders_readiness_reminders 
ON public.orders(specialist_readiness_status, readiness_last_reminder_at) 
WHERE specialist_readiness_status IN ('pending', 'ready');