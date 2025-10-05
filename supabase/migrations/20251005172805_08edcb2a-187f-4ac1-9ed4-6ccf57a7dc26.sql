-- Create function to auto-reject other quotes when one is accepted
CREATE OR REPLACE FUNCTION public.auto_reject_other_quotes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If a quote is accepted (is_accepted = true)
  IF NEW.is_accepted = true AND (OLD.is_accepted IS NULL OR OLD.is_accepted = false) THEN
    -- Reject all other quotes for the same order
    UPDATE public.order_specialists
    SET 
      is_accepted = false,
      rejected_at = NOW(),
      rejection_reason = 'تم اختيار عرض آخر'
    WHERE order_id = NEW.order_id
      AND id != NEW.id
      AND (is_accepted IS NULL OR is_accepted = false)
      AND quoted_price IS NOT NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_reject_quotes ON public.order_specialists;
CREATE TRIGGER trigger_auto_reject_quotes
  AFTER UPDATE ON public.order_specialists
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_reject_other_quotes();

COMMENT ON FUNCTION public.auto_reject_other_quotes() IS 'عند قبول عرض واحد، يتم رفض جميع العروض الأخرى تلقائياً';