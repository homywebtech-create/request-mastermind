-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Company users can view their company users" ON company_users;
DROP POLICY IF EXISTS "Company managers can insert users" ON company_users;
DROP POLICY IF EXISTS "Company managers can update users" ON company_users;
DROP POLICY IF EXISTS "Company managers can delete users" ON company_users;

-- Create a security definer function to check if user belongs to a company
CREATE OR REPLACE FUNCTION public.is_company_member(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE user_id = _user_id
      AND company_id = _company_id
  );
$$;

-- Create new safe policies using profiles table instead of company_users
CREATE POLICY "Company members can view their company users"
ON company_users
FOR SELECT
TO authenticated
USING (
  is_company_member(auth.uid(), company_id)
);

CREATE POLICY "Company members with manage_team can insert users"
ON company_users
FOR INSERT
TO authenticated
WITH CHECK (
  is_company_member(auth.uid(), company_id) 
  AND has_company_permission(auth.uid(), company_id, 'manage_team'::company_permission)
);

CREATE POLICY "Company members with manage_team can update users"
ON company_users
FOR UPDATE
TO authenticated
USING (
  is_company_member(auth.uid(), company_id)
  AND has_company_permission(auth.uid(), company_id, 'manage_team'::company_permission)
)
WITH CHECK (
  is_company_member(auth.uid(), company_id)
  AND has_company_permission(auth.uid(), company_id, 'manage_team'::company_permission)
);

CREATE POLICY "Company members with manage_team can delete users"
ON company_users
FOR DELETE
TO authenticated
USING (
  is_company_member(auth.uid(), company_id)
  AND has_company_permission(auth.uid(), company_id, 'manage_team'::company_permission)
  AND is_owner = false
);