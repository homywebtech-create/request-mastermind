-- Function to automatically add all company specialists to a new order
CREATE OR REPLACE FUNCTION public.auto_add_specialists_to_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only proceed if company_id is set and not sending to all companies
  IF NEW.company_id IS NOT NULL AND NEW.send_to_all_companies = false THEN
    -- Insert all active specialists from the company into order_specialists
    INSERT INTO public.order_specialists (order_id, specialist_id)
    SELECT NEW.id, s.id
    FROM public.specialists s
    WHERE s.company_id = NEW.company_id
      AND s.is_active = true
    ON CONFLICT (order_id, specialist_id) DO NOTHING;
  END IF;
  
  -- If sending to all companies, add all active specialists from all companies
  IF NEW.send_to_all_companies = true THEN
    INSERT INTO public.order_specialists (order_id, specialist_id)
    SELECT NEW.id, s.id
    FROM public.specialists s
    WHERE s.is_active = true
    ON CONFLICT (order_id, specialist_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically add specialists when order is created
DROP TRIGGER IF EXISTS trigger_auto_add_specialists ON public.orders;

CREATE TRIGGER trigger_auto_add_specialists
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_add_specialists_to_order();

-- Also add specialists when order is updated (in case company changes)
DROP TRIGGER IF EXISTS trigger_auto_add_specialists_on_update ON public.orders;

CREATE TRIGGER trigger_auto_add_specialists_on_update
AFTER UPDATE OF company_id, send_to_all_companies ON public.orders
FOR EACH ROW
WHEN (OLD.company_id IS DISTINCT FROM NEW.company_id OR OLD.send_to_all_companies IS DISTINCT FROM NEW.send_to_all_companies)
EXECUTE FUNCTION public.auto_add_specialists_to_order();

-- Add unique constraint to prevent duplicate entries
ALTER TABLE public.order_specialists
DROP CONSTRAINT IF EXISTS order_specialists_order_id_specialist_id_key;

ALTER TABLE public.order_specialists
ADD CONSTRAINT order_specialists_order_id_specialist_id_key UNIQUE (order_id, specialist_id);