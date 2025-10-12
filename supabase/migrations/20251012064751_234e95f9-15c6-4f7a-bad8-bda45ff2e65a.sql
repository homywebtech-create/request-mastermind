-- Create table to store device tokens for push notifications
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES public.specialists(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- Specialists can insert their own tokens
CREATE POLICY "Specialists can insert their own device tokens"
ON public.device_tokens
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM specialists s
    JOIN profiles p ON p.phone = s.phone
    WHERE s.id = device_tokens.specialist_id
    AND p.user_id = auth.uid()
  )
);

-- Specialists can view their own tokens
CREATE POLICY "Specialists can view their own device tokens"
ON public.device_tokens
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM specialists s
    JOIN profiles p ON p.phone = s.phone
    WHERE s.id = device_tokens.specialist_id
    AND p.user_id = auth.uid()
  )
);

-- Specialists can update their own tokens
CREATE POLICY "Specialists can update their own device tokens"
ON public.device_tokens
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM specialists s
    JOIN profiles p ON p.phone = s.phone
    WHERE s.id = device_tokens.specialist_id
    AND p.user_id = auth.uid()
  )
);

-- Admins can view all tokens
CREATE POLICY "Admins can view all device tokens"
ON public.device_tokens
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_device_tokens_specialist_id ON public.device_tokens(specialist_id);
CREATE INDEX idx_device_tokens_token ON public.device_tokens(token);

-- Trigger to update updated_at
CREATE TRIGGER update_device_tokens_updated_at
BEFORE UPDATE ON public.device_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();