-- Add specialists to existing orders that don't have any specialists assigned yet
-- This will fix old orders that were created before the auto-add trigger

-- For orders with a specific company (not sent to all)
INSERT INTO public.order_specialists (order_id, specialist_id)
SELECT DISTINCT o.id, s.id
FROM public.orders o
JOIN public.specialists s ON s.company_id = o.company_id
WHERE o.company_id IS NOT NULL
  AND o.send_to_all_companies = false
  AND s.is_active = true
  -- Only insert if this order doesn't already have this specialist
  AND NOT EXISTS (
    SELECT 1 FROM public.order_specialists os 
    WHERE os.order_id = o.id AND os.specialist_id = s.id
  )
ON CONFLICT (order_id, specialist_id) DO NOTHING;

-- For orders sent to all companies
INSERT INTO public.order_specialists (order_id, specialist_id)
SELECT DISTINCT o.id, s.id
FROM public.orders o
CROSS JOIN public.specialists s
WHERE o.send_to_all_companies = true
  AND s.is_active = true
  -- Only insert if this order doesn't already have this specialist
  AND NOT EXISTS (
    SELECT 1 FROM public.order_specialists os 
    WHERE os.order_id = o.id AND os.specialist_id = s.id
  )
ON CONFLICT (order_id, specialist_id) DO NOTHING;