-- Simplify the insert policy to work correctly
DROP POLICY IF EXISTS "Admins and company managers can insert users" ON company_users;

CREATE POLICY "Allow insert company users"
ON company_users
FOR INSERT
TO authenticated
WITH CHECK (
  -- Simple check: allow if user is admin OR they belong to the same company
  (has_role(auth.uid(), 'admin'::app_role) 
   OR has_role(auth.uid(), 'admin_full'::app_role) 
   OR has_role(auth.uid(), 'admin_manager'::app_role))
  OR
  -- Or if the user is an owner of this company
  EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.company_id = company_users.company_id
      AND cu.is_owner = true
      AND cu.is_active = true
  )
  OR
  -- Or if they have manage_team permission
  has_company_permission(auth.uid(), company_id, 'manage_team'::company_permission)
);