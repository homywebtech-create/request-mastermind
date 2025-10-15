-- Allow specialists to insert their specialties during registration
CREATE POLICY "Specialists can insert specialties during registration"
ON public.specialist_specialties
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.specialists
    WHERE specialists.id = specialist_specialties.specialist_id
      AND specialists.registration_token IS NOT NULL
      AND specialists.approval_status = 'pending'
  )
);

-- Also allow them to delete their specialties during registration
CREATE POLICY "Specialists can delete specialties during registration"
ON public.specialist_specialties
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.specialists
    WHERE specialists.id = specialist_specialties.specialist_id
      AND specialists.registration_token IS NOT NULL
      AND specialists.approval_status = 'pending'
  )
);