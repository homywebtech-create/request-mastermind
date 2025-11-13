-- Create cancellation_settings table for sub-service specific cancellation percentages
CREATE TABLE IF NOT EXISTS public.cancellation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_service_id UUID NOT NULL REFERENCES public.sub_services(id) ON DELETE CASCADE,
  cancellation_percentage NUMERIC(5,2) NOT NULL DEFAULT 50.00 CHECK (cancellation_percentage >= 0 AND cancellation_percentage <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sub_service_id)
);

-- Enable RLS
ALTER TABLE public.cancellation_settings ENABLE ROW LEVEL SECURITY;

-- Admins can manage cancellation settings
CREATE POLICY "Admins can manage cancellation settings"
  ON public.cancellation_settings
  FOR ALL
  USING (
    is_admin(auth.uid()) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'admin_full'::app_role) OR 
    has_role(auth.uid(), 'admin_manager'::app_role)
  )
  WITH CHECK (
    is_admin(auth.uid()) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'admin_full'::app_role) OR 
    has_role(auth.uid(), 'admin_manager'::app_role)
  );

-- Admins can view cancellation settings
CREATE POLICY "Admins can view cancellation settings"
  ON public.cancellation_settings
  FOR SELECT
  USING (
    is_admin(auth.uid()) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'admin_full'::app_role) OR 
    has_role(auth.uid(), 'admin_manager'::app_role) OR
    has_role(auth.uid(), 'admin_viewer'::app_role)
  );

-- Companies and specialists can view cancellation settings
CREATE POLICY "Companies and specialists can view cancellation settings"
  ON public.cancellation_settings
  FOR SELECT
  USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_cancellation_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_cancellation_settings_updated_at
  BEFORE UPDATE ON public.cancellation_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cancellation_settings_updated_at();

-- Insert default cancellation percentages for existing sub-services
INSERT INTO public.cancellation_settings (sub_service_id, cancellation_percentage)
SELECT id, 50.00
FROM public.sub_services
ON CONFLICT (sub_service_id) DO NOTHING;