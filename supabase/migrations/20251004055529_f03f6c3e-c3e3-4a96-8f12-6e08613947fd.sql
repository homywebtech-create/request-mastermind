-- Create verification codes table for WhatsApp OTP
CREATE TABLE public.verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '10 minutes'),
  verified BOOLEAN NOT NULL DEFAULT false,
  attempts INTEGER NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX idx_verification_codes_phone ON public.verification_codes(phone);
CREATE INDEX idx_verification_codes_expires ON public.verification_codes(expires_at);

-- Allow anyone to insert verification codes (needed for signup)
CREATE POLICY "Anyone can request verification codes"
ON public.verification_codes
FOR INSERT
WITH CHECK (true);

-- Allow users to verify their own codes
CREATE POLICY "Users can verify their codes"
ON public.verification_codes
FOR UPDATE
USING (true);

-- Create cleanup function to remove expired codes
CREATE OR REPLACE FUNCTION public.cleanup_expired_verification_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.verification_codes
  WHERE expires_at < now() OR (verified = true AND created_at < now() - interval '1 hour');
END;
$$;