-- Update contract_templates to use sub_service_id instead of service_id
ALTER TABLE public.contract_templates
DROP COLUMN service_id,
ADD COLUMN sub_service_id uuid REFERENCES public.sub_services(id) ON DELETE CASCADE;

-- Add index for better performance
CREATE INDEX idx_contract_templates_sub_service_id ON public.contract_templates(sub_service_id);

-- Add comment
COMMENT ON COLUMN public.contract_templates.sub_service_id IS 'The sub-service this contract is for';