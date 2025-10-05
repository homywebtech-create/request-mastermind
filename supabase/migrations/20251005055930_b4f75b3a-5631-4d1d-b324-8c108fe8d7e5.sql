-- Create specialists table
CREATE TABLE IF NOT EXISTS public.specialists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  specialty text NOT NULL,
  experience_years integer,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add comments
COMMENT ON TABLE public.specialists IS 'المحترفين والخبراء العاملين في الشركات';
COMMENT ON COLUMN public.specialists.specialty IS 'التخصص أو المهارة';
COMMENT ON COLUMN public.specialists.experience_years IS 'سنوات الخبرة';

-- Enable RLS
ALTER TABLE public.specialists ENABLE ROW LEVEL SECURITY;

-- Create policies for specialists

-- Admins can view all specialists
CREATE POLICY "Admins can view all specialists"
ON public.specialists
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert specialists
CREATE POLICY "Admins can insert specialists"
ON public.specialists
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update specialists
CREATE POLICY "Admins can update specialists"
ON public.specialists
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete specialists
CREATE POLICY "Admins can delete specialists"
ON public.specialists
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Companies can view their own specialists
CREATE POLICY "Companies can view their own specialists"
ON public.specialists
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = specialists.company_id
  )
);

-- Companies can insert their own specialists
CREATE POLICY "Companies can insert their own specialists"
ON public.specialists
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = specialists.company_id
  )
);

-- Companies can update their own specialists
CREATE POLICY "Companies can update their own specialists"
ON public.specialists
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = specialists.company_id
  )
);

-- Companies can delete their own specialists
CREATE POLICY "Companies can delete their own specialists"
ON public.specialists
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.company_id = specialists.company_id
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_specialists_updated_at
BEFORE UPDATE ON public.specialists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Block anonymous access
CREATE POLICY "Block anonymous access to specialists"
ON public.specialists
FOR SELECT
TO anon
USING (false);