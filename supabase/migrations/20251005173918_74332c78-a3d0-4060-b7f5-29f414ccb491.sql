-- Allow specialists to see order_specialists records
-- First, fix the INSERT policy for order_specialists to allow admins and specialists
DROP POLICY IF EXISTS "Admins can insert order specialists" ON public.order_specialists;
CREATE POLICY "Admins and specialists can insert order specialists"
ON public.order_specialists
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow admins
  has_role(auth.uid(), 'admin'::app_role)
  OR 
  -- Allow specialists with company_id in their profile
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
      AND company_id IS NOT NULL
  )
);

-- Update the SELECT policy to allow specialists to see their company's order_specialists
DROP POLICY IF EXISTS "Companies can view their order specialists" ON public.order_specialists;
CREATE POLICY "Companies can view their order specialists"
ON public.order_specialists
FOR SELECT
TO authenticated
USING (
  -- Admins can see all
  has_role(auth.uid(), 'admin'::app_role)
  OR
  -- Specialists can see records for their company
  EXISTS (
    SELECT 1 
    FROM public.specialists s
    JOIN public.profiles p ON p.phone = s.phone
    WHERE p.user_id = auth.uid()
      AND s.id = order_specialists.specialist_id
  )
);