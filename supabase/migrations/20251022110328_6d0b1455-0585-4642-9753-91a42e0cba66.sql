-- Test by creating a very simple admin policy
-- First, let's check if there are conflicting policies
DROP POLICY IF EXISTS "Admins can insert company users" ON company_users;

-- Create ultra-simple admin policy
CREATE POLICY "Super admin insert"
ON company_users
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = 'bc40e916-6e60-4b14-b208-d67d309c2e57'::uuid
  OR
  has_role(auth.uid(), 'admin'::app_role)
  OR
  has_role(auth.uid(), 'admin_full'::app_role)
  OR
  has_role(auth.uid(), 'admin_manager'::app_role)
);