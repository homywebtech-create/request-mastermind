-- Temporarily relax token-based registration policies for specialists and related specialties
-- Drop existing token-based policies
DROP POLICY IF EXISTS "Allow public access to specialists with valid registration toke" ON public.specialists;
DROP POLICY IF EXISTS "Allow specialists to update their own profile with registration" ON public.specialists;

DROP POLICY IF EXISTS "Specialists can delete specialties during registration" ON public.specialist_specialties;
DROP POLICY IF EXISTS "Specialists can insert specialties during registration" ON public.specialist_specialties;

-- Create safer temporary policies: allow registration by approval status and not yet completed
CREATE POLICY "Public can view pending specialists for registration"
ON public.specialists
FOR SELECT
USING (approval_status = 'pending' AND registration_completed_at IS NULL);

CREATE POLICY "Public can update pending specialists during registration"
ON public.specialists
FOR UPDATE
USING (approval_status = 'pending' AND registration_completed_at IS NULL)
WITH CHECK (approval_status = 'pending' AND registration_completed_at IS NULL);

-- Allow inserting/deleting specialties during registration window
CREATE POLICY "Public can insert specialties during registration"
ON public.specialist_specialties
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.specialists s
    WHERE s.id = specialist_specialties.specialist_id
      AND s.approval_status = 'pending'
      AND s.registration_completed_at IS NULL
  )
);

CREATE POLICY "Public can delete specialties during registration"
ON public.specialist_specialties
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.specialists s
    WHERE s.id = specialist_specialties.specialist_id
      AND s.approval_status = 'pending'
      AND s.registration_completed_at IS NULL
  )
);