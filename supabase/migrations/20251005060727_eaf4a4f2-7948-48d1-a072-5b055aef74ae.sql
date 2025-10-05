-- Remove email column from specialists
ALTER TABLE public.specialists DROP COLUMN IF EXISTS email;

-- Remove sub_service_id column (we'll use a junction table instead)
ALTER TABLE public.specialists DROP COLUMN IF EXISTS sub_service_id;

-- Create junction table for specialists and sub_services (many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.specialist_specialties (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  specialist_id uuid NOT NULL REFERENCES public.specialists(id) ON DELETE CASCADE,
  sub_service_id uuid NOT NULL REFERENCES public.sub_services(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(specialist_id, sub_service_id)
);

COMMENT ON TABLE public.specialist_specialties IS 'ربط المحترفين بتخصصاتهم (علاقة متعدد لمتعدد)';

-- Enable RLS
ALTER TABLE public.specialist_specialties ENABLE ROW LEVEL SECURITY;

-- Create policies for specialist_specialties

-- Admins can view all
CREATE POLICY "Admins can view all specialist specialties"
ON public.specialist_specialties
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert
CREATE POLICY "Admins can insert specialist specialties"
ON public.specialist_specialties
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete
CREATE POLICY "Admins can delete specialist specialties"
ON public.specialist_specialties
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Companies can view their specialists' specialties
CREATE POLICY "Companies can view their specialist specialties"
ON public.specialist_specialties
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.specialists
    JOIN public.profiles ON profiles.company_id = specialists.company_id
    WHERE specialists.id = specialist_specialties.specialist_id
      AND profiles.user_id = auth.uid()
  )
);

-- Companies can insert specialties for their specialists
CREATE POLICY "Companies can insert their specialist specialties"
ON public.specialist_specialties
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.specialists
    JOIN public.profiles ON profiles.company_id = specialists.company_id
    WHERE specialists.id = specialist_specialties.specialist_id
      AND profiles.user_id = auth.uid()
  )
);

-- Companies can delete specialties for their specialists
CREATE POLICY "Companies can delete their specialist specialties"
ON public.specialist_specialties
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.specialists
    JOIN public.profiles ON profiles.company_id = specialists.company_id
    WHERE specialists.id = specialist_specialties.specialist_id
      AND profiles.user_id = auth.uid()
  )
);

-- Block anonymous access
CREATE POLICY "Block anonymous access to specialist specialties"
ON public.specialist_specialties
FOR SELECT
TO anon
USING (false);