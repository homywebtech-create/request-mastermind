-- Create app_versions table to manage APK updates
CREATE TABLE IF NOT EXISTS public.app_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_code INTEGER NOT NULL UNIQUE,
  version_name TEXT NOT NULL,
  apk_url TEXT NOT NULL,
  changelog TEXT,
  is_mandatory BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read versions (needed for update checks)
CREATE POLICY "Anyone can read app versions"
  ON public.app_versions
  FOR SELECT
  USING (true);

-- Only admins can manage versions
CREATE POLICY "Only admins can insert versions"
  ON public.app_versions
  FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update versions"
  ON public.app_versions
  FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete versions"
  ON public.app_versions
  FOR DELETE
  USING (is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_app_versions_updated_at
  BEFORE UPDATE ON public.app_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial version (update this with your current version)
INSERT INTO public.app_versions (version_code, version_name, apk_url, changelog, is_mandatory)
VALUES (1, '1.0.0', 'https://your-storage-url/app-v1.0.0.apk', 'Initial release', false)
ON CONFLICT (version_code) DO NOTHING;