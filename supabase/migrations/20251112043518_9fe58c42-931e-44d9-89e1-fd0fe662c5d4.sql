-- Create wallet_policies table to manage wallet compensation rules
CREATE TABLE IF NOT EXISTS public.wallet_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key TEXT NOT NULL UNIQUE,
  policy_name_ar TEXT NOT NULL,
  policy_name_en TEXT NOT NULL,
  compensation_amount NUMERIC NOT NULL DEFAULT 0,
  description_ar TEXT,
  description_en TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wallet_policies ENABLE ROW LEVEL SECURITY;

-- Admins can manage all policies
CREATE POLICY "Admins can manage wallet policies"
ON public.wallet_policies
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Everyone can view active policies
CREATE POLICY "Public can view active wallet policies"
ON public.wallet_policies
FOR SELECT
USING (is_active = true);

-- Insert default policy for customer no-show
INSERT INTO public.wallet_policies (
  policy_key,
  policy_name_ar,
  policy_name_en,
  compensation_amount,
  description_ar,
  description_en
) VALUES (
  'customer_no_show',
  'تعويض عدم حضور العميل',
  'Customer No-Show Compensation',
  50,
  'التعويض الذي يحصل عليه المحترف عندما ينتظر العميل 15 دقيقة ولا يرد',
  'Compensation for specialist when customer does not respond after 15 minutes wait'
);

-- Add comment
COMMENT ON TABLE public.wallet_policies IS 'Stores wallet compensation policies and rules';