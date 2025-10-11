-- Drop all existing policies on customers table
DROP POLICY IF EXISTS "Admins can view all customers" ON public.customers;
DROP POLICY IF EXISTS "Public can insert customers without restrictions" ON public.customers;
DROP POLICY IF EXISTS "Specialists can view customers of their assigned orders" ON public.customers;
DROP POLICY IF EXISTS "Users can update customers" ON public.customers;

-- Disable RLS temporarily to ensure clean slate
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Create completely permissive INSERT policy for all users
CREATE POLICY "Allow all inserts on customers"
ON public.customers
FOR INSERT
TO public
WITH CHECK (true);

-- Create SELECT policies
CREATE POLICY "Admins can view all customers"
ON public.customers
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Specialists can view their assigned customers"
ON public.customers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM orders o
    JOIN order_specialists os ON os.order_id = o.id
    JOIN specialists s ON s.id = os.specialist_id
    JOIN profiles p ON p.phone = s.phone
    WHERE o.customer_id = customers.id 
    AND p.user_id = auth.uid()
  )
);

-- Create UPDATE policy
CREATE POLICY "Authenticated users can update customers"
ON public.customers
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);