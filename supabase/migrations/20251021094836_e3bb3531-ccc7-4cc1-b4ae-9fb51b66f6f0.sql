-- Update the main admin user to have only admin_full role (full permissions)
-- First, delete the regular admin role
DELETE FROM user_roles 
WHERE user_id = 'bc40e916-6e60-4b14-b208-d67d309c2e57' 
AND role = 'admin';

-- Keep only admin_full role for this user