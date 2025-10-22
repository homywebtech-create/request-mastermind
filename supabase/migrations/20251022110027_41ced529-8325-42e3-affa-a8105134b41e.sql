-- Remove the ALL policy that might be conflicting
DROP POLICY IF EXISTS "Admins can manage company users" ON company_users;

-- Recreate specific policies for admins
CREATE POLICY "Admins can insert company users"
ON company_users
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_full'::app_role)
  OR has_role(auth.uid(), 'admin_manager'::app_role)
);

CREATE POLICY "Admins can update company users"
ON company_users
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_full'::app_role)
  OR has_role(auth.uid(), 'admin_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_full'::app_role)
  OR has_role(auth.uid(), 'admin_manager'::app_role)
);

CREATE POLICY "Admins can delete company users"
ON company_users
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_full'::app_role)
  OR has_role(auth.uid(), 'admin_manager'::app_role)
);

-- Also drop the old insert policy since we have a new one above
DROP POLICY IF EXISTS "Company users insert policy" ON company_users;