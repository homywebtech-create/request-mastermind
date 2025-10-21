-- تحديث function is_admin لتشمل جميع أنواع admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('admin'::app_role, 'admin_full'::app_role, 'admin_manager'::app_role, 'admin_viewer'::app_role)
  )
$$;

-- تحديث RLS policy على profiles للسماح لجميع admins بالوصول
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));
