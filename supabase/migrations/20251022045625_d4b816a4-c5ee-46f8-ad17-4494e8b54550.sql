-- Add service_id and contract_type to contract_templates
ALTER TABLE public.contract_templates
ADD COLUMN service_id uuid REFERENCES public.services(id) ON DELETE CASCADE,
ADD COLUMN contract_type text NOT NULL DEFAULT 'full_contract' CHECK (contract_type IN ('full_contract', 'terms_only'));

-- Add index for better performance
CREATE INDEX idx_contract_templates_service_id ON public.contract_templates(service_id);

-- Add comments
COMMENT ON COLUMN public.contract_templates.service_id IS 'The service this contract is for';
COMMENT ON COLUMN public.contract_templates.contract_type IS 'Type of contract: full_contract or terms_only';