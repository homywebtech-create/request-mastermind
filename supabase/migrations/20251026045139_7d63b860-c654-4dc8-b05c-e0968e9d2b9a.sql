-- Fix RLS policies for order_specialists table to allow admins to read all assignments
-- This fixes the issue where resending orders fails due to RLS blocking the existing assignments check

-- Drop the restrictive admin select policy
DROP POLICY IF EXISTS "Admins can view all order specialists" ON public.order_specialists;

-- Create a comprehensive admin policy that allows viewing ALL order_specialists
CREATE POLICY "Admins can view all order specialists"
  ON public.order_specialists
  FOR SELECT
  TO authenticated
  USING (
    is_admin(auth.uid()) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'admin_full'::app_role) OR
    has_role(auth.uid(), 'admin_manager'::app_role) OR
    has_role(auth.uid(), 'admin_viewer'::app_role)
  );

-- Also ensure companies can view their own order_specialists (even without quotes)
CREATE POLICY "Companies can view their order specialists"
  ON public.order_specialists
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM specialists s
      JOIN profiles p ON p.company_id = s.company_id
      WHERE s.id = order_specialists.specialist_id
        AND p.user_id = auth.uid()
    )
  );