-- Fix companies UPDATE policy to include all admin roles
DROP POLICY IF EXISTS "Admins can update companies" ON companies;

CREATE POLICY "Admins can update companies"
ON companies
FOR UPDATE
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