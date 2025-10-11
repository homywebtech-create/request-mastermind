-- Drop all existing policies on user_roles
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Block anonymous access to user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

-- Create simple, non-conflicting policies
-- Policy 1: Allow authenticated users to read their own roles
CREATE POLICY "read_own_roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Policy 2: Allow admins to read all roles (using security definer function)
CREATE POLICY "admins_read_all_roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Policy 3: Allow admins to insert roles
CREATE POLICY "admins_insert_roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

-- Policy 4: Allow admins to update roles
CREATE POLICY "admins_update_roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Policy 5: Allow admins to delete roles
CREATE POLICY "admins_delete_roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));