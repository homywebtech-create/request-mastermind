-- Fix RLS policies for order_specialists to allow specialists to view their orders

-- Drop existing problematic SELECT policies
DROP POLICY IF EXISTS "Companies can view their order specialists" ON public.order_specialists;
DROP POLICY IF EXISTS "Admins can view all order specialists" ON public.order_specialists;

-- Create new SELECT policies
-- Policy 1: Admins can view all
CREATE POLICY "Admins can view all order specialists"
ON public.order_specialists
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy 2: Specialists can view orders assigned to them directly
CREATE POLICY "Specialists can view their assigned orders"
ON public.order_specialists
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.specialists s
    JOIN public.profiles p ON p.phone = s.phone
    WHERE s.id = order_specialists.specialist_id
    AND p.user_id = auth.uid()
  )
);