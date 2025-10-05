-- Allow admins and companies to update order_specialists (accept/reject quotes)
CREATE POLICY "Admins and companies can update order specialists"
ON public.order_specialists
FOR UPDATE
TO authenticated
USING (
  -- Admins can update all
  has_role(auth.uid(), 'admin'::app_role)
  OR
  -- Companies can update their own order specialists
  EXISTS (
    SELECT 1 
    FROM public.specialists s
    JOIN public.profiles p ON p.company_id = s.company_id
    WHERE s.id = order_specialists.specialist_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  -- Same conditions for WITH CHECK
  has_role(auth.uid(), 'admin'::app_role)
  OR
  EXISTS (
    SELECT 1 
    FROM public.specialists s
    JOIN public.profiles p ON p.company_id = s.company_id
    WHERE s.id = order_specialists.specialist_id
      AND p.user_id = auth.uid()
  )
);