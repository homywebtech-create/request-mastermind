-- Update super admin email in profiles
UPDATE profiles 
SET email = 'eng3moh@gmail.com'
WHERE user_id = 'bc40e916-6e60-4b14-b208-d67d309c2e57';

-- Protect super admin from deletion in profiles
CREATE POLICY "Prevent super admin deletion from profiles"
ON profiles
FOR DELETE
USING (user_id != 'bc40e916-6e60-4b14-b208-d67d309c2e57');

-- Protect super admin roles from deletion
CREATE POLICY "Prevent super admin role deletion"
ON user_roles
FOR DELETE
USING (user_id != 'bc40e916-6e60-4b14-b208-d67d309c2e57');

-- Protect super admin roles from updates that change user_id or role
CREATE POLICY "Prevent super admin role modification"
ON user_roles
FOR UPDATE
USING (user_id != 'bc40e916-6e60-4b14-b208-d67d309c2e57')
WITH CHECK (user_id != 'bc40e916-6e60-4b14-b208-d67d309c2e57');