-- Add customer_area and customer_budget to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS area text,
ADD COLUMN IF NOT EXISTS budget text;

-- Add comment for documentation
COMMENT ON COLUMN public.customers.area IS 'منطقة العميل';
COMMENT ON COLUMN public.customers.budget IS 'الميزانية المطلوبة من العميل';