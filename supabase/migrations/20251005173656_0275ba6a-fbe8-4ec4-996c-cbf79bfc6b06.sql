-- Fix specialist profiles that are missing company_id
-- Update profiles for specialists to include their company_id
UPDATE public.profiles p
SET company_id = s.company_id
FROM public.specialists s
WHERE p.phone = s.phone
  AND p.company_id IS NULL
  AND s.company_id IS NOT NULL;

-- Add policy for specialists to insert orders for their company
DROP POLICY IF EXISTS "Specialists can insert orders for their company" ON public.orders;
CREATE POLICY "Specialists can insert orders for their company"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  (
    -- Allow if user is a specialist with a company_id in their profile
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
        AND company_id IS NOT NULL
        AND (
          -- Allow if order is for their company
          (profiles.company_id = orders.company_id)
          -- Or if sending to all companies
          OR (orders.send_to_all_companies = true)
          -- Or if no specific company assigned
          OR (orders.company_id IS NULL)
        )
    )
  )
  AND NOT has_role(auth.uid(), 'admin'::app_role)
);