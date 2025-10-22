-- Drop and recreate with simpler logic
DROP POLICY IF EXISTS "Allow insert company users" ON company_users;

-- Create simple policy that works
CREATE POLICY "Company users insert policy"
ON company_users
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow all admins without any conditions
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_full'::app_role)
  OR has_role(auth.uid(), 'admin_manager'::app_role)
  OR
  -- Allow company owners
  EXISTS (
    SELECT 1 FROM company_users existing_cu
    WHERE existing_cu.user_id = auth.uid()
      AND existing_cu.company_id = company_users.company_id
      AND existing_cu.is_owner = true
      AND existing_cu.is_active = true
  )
);