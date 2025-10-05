-- Create order_specialists junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS public.order_specialists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  specialist_id uuid NOT NULL REFERENCES public.specialists(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(order_id, specialist_id)
);

-- Enable RLS
ALTER TABLE public.order_specialists ENABLE ROW LEVEL SECURITY;

-- Create policies for admins
CREATE POLICY "Admins can view all order specialists"
  ON public.order_specialists
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert order specialists"
  ON public.order_specialists
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete order specialists"
  ON public.order_specialists
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create policies for companies
CREATE POLICY "Companies can view their order specialists"
  ON public.order_specialists
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.profiles p ON p.user_id = auth.uid()
      WHERE o.id = order_specialists.order_id
      AND (o.company_id = p.company_id OR o.send_to_all_companies = true)
    )
  );

-- Add index for better performance
CREATE INDEX idx_order_specialists_order_id ON public.order_specialists(order_id);
CREATE INDEX idx_order_specialists_specialist_id ON public.order_specialists(specialist_id);