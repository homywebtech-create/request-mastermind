-- Drop the problematic insert policy
DROP POLICY IF EXISTS "Company members with manage_team can insert users" ON company_users;

-- Create new policy that allows company owners to add users
CREATE POLICY "Company owners and managers can insert users"
ON company_users
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow if user is from the same company (via profiles)
  is_company_member(auth.uid(), company_id)
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
  )
);