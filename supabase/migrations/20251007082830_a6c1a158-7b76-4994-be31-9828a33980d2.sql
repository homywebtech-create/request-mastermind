-- Create trigger to auto-add specialists when order is created
DROP TRIGGER IF EXISTS trigger_auto_add_specialists_to_order ON public.orders;

CREATE TRIGGER trigger_auto_add_specialists_to_order
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_add_specialists_to_order();

-- Create trigger to auto-reject other quotes when one is accepted
DROP TRIGGER IF EXISTS trigger_auto_reject_other_quotes ON public.order_specialists;

CREATE TRIGGER trigger_auto_reject_other_quotes
AFTER UPDATE ON public.order_specialists
FOR EACH ROW
EXECUTE FUNCTION public.auto_reject_other_quotes();

-- Create trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS trigger_update_orders_updated_at ON public.orders;

CREATE TRIGGER trigger_update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to update companies updated_at
DROP TRIGGER IF EXISTS trigger_update_companies_updated_at ON public.companies;

CREATE TRIGGER trigger_update_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to update specialists updated_at
DROP TRIGGER IF EXISTS trigger_update_specialists_updated_at ON public.specialists;

CREATE TRIGGER trigger_update_specialists_updated_at
BEFORE UPDATE ON public.specialists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to update profiles updated_at
DROP TRIGGER IF EXISTS trigger_update_profiles_updated_at ON public.profiles;

CREATE TRIGGER trigger_update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();