-- Add RLS policy to allow public creation of specialist registrations
-- This allows anyone to create a pending specialist registration
CREATE POLICY "Public can create pending specialist registrations"
ON public.specialists
FOR INSERT
WITH CHECK (
  approval_status = 'pending'
  AND registration_completed_at IS NULL
  AND name = ''
);