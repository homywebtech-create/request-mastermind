-- Drop all triggers first, then the function
DROP TRIGGER IF EXISTS on_order_created ON public.orders;
DROP TRIGGER IF EXISTS trigger_auto_add_specialists ON public.orders;
DROP TRIGGER IF EXISTS trigger_auto_add_specialists_on_update ON public.orders;
DROP TRIGGER IF EXISTS trigger_auto_add_specialists_to_order ON public.orders;

-- Now drop the function with CASCADE to handle any remaining dependencies
DROP FUNCTION IF EXISTS public.auto_add_specialists_to_order() CASCADE;