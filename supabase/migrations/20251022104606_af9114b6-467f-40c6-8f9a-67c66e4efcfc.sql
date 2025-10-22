-- Drop and recreate the insert policy to include admins
DROP POLICY IF EXISTS "Company owners and managers can insert users" ON company_users;

CREATE POLICY "Admins and company managers can insert users"
ON company_users
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow admins
  (has_role(auth.uid(), 'admin'::app_role) 
   OR has_role(auth.uid(), 'admin_full'::app_role) 
   OR has_role(auth.uid(), 'admin_manager'::app_role))
  OR
  -- Allow company members
  (is_company_member(auth.uid(), company_id)
   AND (
     -- They are an owner in this company
     EXISTS (
       SELECT 1 FROM company_users cu
       WHERE cu.user_id = auth.uid()
         AND cu.company_id = company_users.company_id
         AND cu.is_owner = true
         AND cu.is_active = true
     )
     -- OR they have manage_team permission
     OR has_company_permission(auth.uid(), company_id, 'manage_team'::company_permission)
   ))
);