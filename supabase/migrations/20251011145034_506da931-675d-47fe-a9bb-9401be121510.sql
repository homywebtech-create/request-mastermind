-- Drop the problematic admin policy if it exists
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

-- Recreate it using the is_admin function to avoid recursion
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));