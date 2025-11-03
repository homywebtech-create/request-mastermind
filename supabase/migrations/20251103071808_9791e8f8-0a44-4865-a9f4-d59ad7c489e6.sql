-- Add online/offline status fields to specialists table
ALTER TABLE public.specialists 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS offline_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS offline_reason TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.specialists.is_online IS 'Whether specialist is available to receive new orders';
COMMENT ON COLUMN public.specialists.offline_until IS 'Timestamp until which specialist wants to stay offline';
COMMENT ON COLUMN public.specialists.offline_reason IS 'Reason for going offline (optional)';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_specialists_is_online ON public.specialists(is_online) WHERE is_online = true;
CREATE INDEX IF NOT EXISTS idx_specialists_offline_until ON public.specialists(offline_until) WHERE offline_until IS NOT NULL;

-- Create function to automatically set specialist back online when offline_until expires
CREATE OR REPLACE FUNCTION public.auto_set_specialist_online()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.specialists
  SET 
    is_online = true,
    offline_until = NULL,
    offline_reason = NULL
  WHERE 
    is_online = false 
    AND offline_until IS NOT NULL 
    AND offline_until <= NOW();
END;
$$;