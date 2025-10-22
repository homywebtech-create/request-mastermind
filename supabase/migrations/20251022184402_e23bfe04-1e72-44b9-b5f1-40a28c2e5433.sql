-- Create the trigger that calls the notification function
CREATE TRIGGER notify_on_order_expiry
AFTER UPDATE OF expires_at ON public.orders
FOR EACH ROW
EXECUTE FUNCTION check_and_notify_expired_order();