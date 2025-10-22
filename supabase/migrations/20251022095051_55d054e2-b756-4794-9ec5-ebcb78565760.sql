-- Create enum for company user permissions
CREATE TYPE public.company_permission AS ENUM (
  'manage_specialists',
  'view_specialists',
  'manage_orders',
  'view_orders',
  'manage_contracts',
  'view_contracts',
  'manage_team',
  'view_reports'
);

-- Create company_users table
CREATE TABLE public.company_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_owner BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(company_id, user_id),
  UNIQUE(company_id, email)
);

-- Create company_user_permissions table
CREATE TABLE public.company_user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_user_id UUID NOT NULL REFERENCES public.company_users(id) ON DELETE CASCADE,
  permission company_permission NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_user_id, permission)
);

-- Enable RLS
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_user_permissions ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check company user permissions
CREATE OR REPLACE FUNCTION public.has_company_permission(_user_id UUID, _company_id UUID, _permission company_permission)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_users cu
    JOIN public.company_user_permissions cup ON cup.company_user_id = cu.id
    WHERE cu.user_id = _user_id
      AND cu.company_id = _company_id
      AND cu.is_active = true
      AND cup.permission = _permission
  ) OR EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.user_id = _user_id
      AND cu.company_id = _company_id
      AND cu.is_active = true
      AND cu.is_owner = true
  )
$$;

-- RLS Policies for company_users

-- Admins can view all company users
CREATE POLICY "Admins can view all company users"
ON public.company_users
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'admin_full'::app_role) OR 
  has_role(auth.uid(), 'admin_manager'::app_role) OR 
  has_role(auth.uid(), 'admin_viewer'::app_role)
);

-- Company users can view their company's users
CREATE POLICY "Company users can view their company users"
ON public.company_users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.company_id = company_users.company_id
      AND cu.is_active = true
  )
);

-- Company owners and users with manage_team permission can insert users
CREATE POLICY "Company managers can insert users"
ON public.company_users
FOR INSERT
TO authenticated
WITH CHECK (
  has_company_permission(auth.uid(), company_id, 'manage_team'::company_permission)
);

-- Company owners and users with manage_team permission can update users
CREATE POLICY "Company managers can update users"
ON public.company_users
FOR UPDATE
TO authenticated
USING (
  has_company_permission(auth.uid(), company_id, 'manage_team'::company_permission)
)
WITH CHECK (
  has_company_permission(auth.uid(), company_id, 'manage_team'::company_permission)
);

-- Company owners and users with manage_team permission can delete users (except owners)
CREATE POLICY "Company managers can delete users"
ON public.company_users
FOR DELETE
TO authenticated
USING (
  has_company_permission(auth.uid(), company_id, 'manage_team'::company_permission)
  AND is_owner = false
);

-- Admins can manage all company users
CREATE POLICY "Admins can manage company users"
ON public.company_users
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'admin_full'::app_role) OR 
  has_role(auth.uid(), 'admin_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'admin_full'::app_role) OR 
  has_role(auth.uid(), 'admin_manager'::app_role)
);

-- RLS Policies for company_user_permissions

-- Company users can view permissions in their company
CREATE POLICY "Company users can view permissions"
ON public.company_user_permissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.id = company_user_permissions.company_user_id
      AND EXISTS (
        SELECT 1 FROM public.company_users cu2
        WHERE cu2.user_id = auth.uid()
          AND cu2.company_id = cu.company_id
          AND cu2.is_active = true
      )
  )
);

-- Company managers can manage permissions
CREATE POLICY "Company managers can manage permissions"
ON public.company_user_permissions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.id = company_user_permissions.company_user_id
      AND has_company_permission(auth.uid(), cu.company_id, 'manage_team'::company_permission)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.id = company_user_permissions.company_user_id
      AND has_company_permission(auth.uid(), cu.company_id, 'manage_team'::company_permission)
  )
);

-- Admins can manage all permissions
CREATE POLICY "Admins can manage all permissions"
ON public.company_user_permissions
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'admin_full'::app_role) OR 
  has_role(auth.uid(), 'admin_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'admin_full'::app_role) OR 
  has_role(auth.uid(), 'admin_manager'::app_role)
);

-- Create trigger to update updated_at
CREATE TRIGGER update_company_users_updated_at
BEFORE UPDATE ON public.company_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing company profiles to company_users as owners
INSERT INTO public.company_users (company_id, user_id, full_name, email, phone, is_owner, is_active, created_by)
SELECT 
  p.company_id,
  p.user_id,
  p.full_name,
  COALESCE(p.email, au.email),
  p.phone,
  true,
  p.is_active,
  p.user_id
FROM public.profiles p
JOIN auth.users au ON au.id = p.user_id
WHERE p.company_id IS NOT NULL
ON CONFLICT (company_id, user_id) DO NOTHING;