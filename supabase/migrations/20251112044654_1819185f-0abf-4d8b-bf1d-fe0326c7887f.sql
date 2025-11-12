-- Add policy type and implementation status fields to wallet_policies
ALTER TABLE public.wallet_policies 
ADD COLUMN policy_type TEXT NOT NULL DEFAULT 'specialist',
ADD COLUMN implementation_status TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN tested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN tested_by UUID,
ADD COLUMN test_notes TEXT;

-- Add check constraint for policy_type
ALTER TABLE public.wallet_policies
ADD CONSTRAINT wallet_policies_policy_type_check 
CHECK (policy_type IN ('specialist', 'customer', 'shared'));

-- Add check constraint for implementation_status
ALTER TABLE public.wallet_policies
ADD CONSTRAINT wallet_policies_implementation_status_check 
CHECK (implementation_status IN ('pending', 'in_development', 'testing', 'implemented', 'verified'));

-- Update existing customer_no_show policy to show it's implemented and verified
UPDATE public.wallet_policies
SET 
  policy_type = 'specialist',
  implementation_status = 'implemented'
WHERE policy_key = 'customer_no_show';

-- Add comments
COMMENT ON COLUMN public.wallet_policies.policy_type IS 'Who the policy applies to: specialist (للمحترفين), customer (للعملاء), shared (مشترك)';
COMMENT ON COLUMN public.wallet_policies.implementation_status IS 'Implementation status: pending (قيد الانتظار), in_development (قيد التطوير), testing (قيد الاختبار), implemented (تم التطبيق), verified (تم التأكيد)';
COMMENT ON COLUMN public.wallet_policies.tested_at IS 'When the policy was tested and verified';
COMMENT ON COLUMN public.wallet_policies.tested_by IS 'Admin user who verified the policy';
COMMENT ON COLUMN public.wallet_policies.test_notes IS 'Notes from testing and verification';