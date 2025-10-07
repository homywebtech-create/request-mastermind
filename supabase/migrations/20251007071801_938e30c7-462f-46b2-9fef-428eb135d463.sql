-- Create deletion requests table
CREATE TABLE public.deletion_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  company_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Enable RLS
ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

-- Admins can view all deletion requests
CREATE POLICY "Admins can view all deletion requests"
ON public.deletion_requests
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert deletion requests
CREATE POLICY "Admins can insert deletion requests"
ON public.deletion_requests
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update deletion requests
CREATE POLICY "Admins can update deletion requests"
ON public.deletion_requests
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Companies can insert their own deletion requests
CREATE POLICY "Companies can request deletion"
ON public.deletion_requests
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = deletion_requests.company_id
  )
);

-- Companies can view their own deletion requests
CREATE POLICY "Companies can view their requests"
ON public.deletion_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = deletion_requests.company_id
  )
);

-- Create index for better performance
CREATE INDEX idx_deletion_requests_status ON public.deletion_requests(status);
CREATE INDEX idx_deletion_requests_company ON public.deletion_requests(company_id);