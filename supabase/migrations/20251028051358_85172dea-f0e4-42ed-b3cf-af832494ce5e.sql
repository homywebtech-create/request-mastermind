-- Fix RLS policy for specialist registration completion
-- The issue is that the policy requires registration_completed_at to be NULL in the WITH CHECK
-- But we're trying to SET it to a non-null value during registration completion

-- Drop the existing policy
DROP POLICY IF EXISTS "Public can update pending specialists during registration" ON specialists;

-- Create an improved policy that allows updating registration_completed_at
CREATE POLICY "Public can update pending specialists during registration"
ON specialists
FOR UPDATE
USING (
  -- Check the CURRENT state (before update)
  approval_status = 'pending'
  AND registration_completed_at IS NULL
)
WITH CHECK (
  -- Allow the update as long as it's still pending
  -- and either registration_completed_at is still NULL or being set for first time
  approval_status = 'pending'
);