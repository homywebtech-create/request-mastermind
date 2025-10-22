-- Replace trigger to fire on insert and relevant updates
DROP TRIGGER IF EXISTS notify_on_order_expiry ON public.orders;
CREATE TRIGGER notify_on_order_expiry
AFTER INSERT OR UPDATE OF expires_at, last_sent_at, status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION check_and_notify_expired_order();