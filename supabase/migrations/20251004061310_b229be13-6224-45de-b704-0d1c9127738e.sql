-- ============================================
-- Fix: Block Anonymous Access to Sensitive Tables
-- ============================================
-- Problem: Tables with only RESTRICTIVE policies don't explicitly block
-- anonymous users, potentially exposing sensitive data publicly

-- Block anonymous access to orders table
-- This prevents unauthorized access to order details, links, and customer associations
CREATE POLICY "Block anonymous access to orders"
ON public.orders
FOR SELECT
TO anon
USING (false);

-- Block anonymous access to companies table
-- This prevents public scraping of business contact information
CREATE POLICY "Block anonymous access to companies"
ON public.companies
FOR SELECT
TO anon
USING (false);

-- Block anonymous access to customers table
-- This prevents exposure of customer names and WhatsApp numbers
CREATE POLICY "Block anonymous access to customers"
ON public.customers
FOR SELECT
TO anon
USING (false);

-- Block anonymous access to profiles table
-- This prevents exposure of employee information
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);

-- Block anonymous access to user_roles table
-- This prevents enumeration of user permissions
CREATE POLICY "Block anonymous access to user_roles"
ON public.user_roles
FOR SELECT
TO anon
USING (false);

-- Add comments explaining the security measure
COMMENT ON POLICY "Block anonymous access to orders" ON public.orders IS
'Explicitly blocks all anonymous access to order data. Only authenticated users with proper roles can view orders through RESTRICTIVE policies.';

COMMENT ON POLICY "Block anonymous access to companies" ON public.companies IS
'Prevents public scraping of business contact information. Only admins can view company data.';

COMMENT ON POLICY "Block anonymous access to customers" ON public.customers IS
'Protects customer PII from public access. Only authenticated users within the same company can view customers.';

COMMENT ON POLICY "Block anonymous access to profiles" ON public.profiles IS
'Prevents enumeration of employee data. Users can only view their own profile, admins can view all.';

COMMENT ON POLICY "Block anonymous access to user_roles" ON public.user_roles IS
'Prevents discovery of user permission levels. Only users can view their own roles and admins can manage all roles.';