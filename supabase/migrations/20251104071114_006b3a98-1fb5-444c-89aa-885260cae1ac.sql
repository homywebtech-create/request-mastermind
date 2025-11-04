-- Fix RLS policy for orders table to allow admins to insert orders
-- Drop the existing policy that uses has_role
DROP POLICY IF EXISTS "Admins can insert orders" ON orders;

-- Create a new policy using is_admin function which is more reliable
CREATE POLICY "Admins can insert orders"
ON orders
FOR INSERT
TO authenticated
WITH CHECK (
  is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'admin_full', 'admin_manager')
  )
);