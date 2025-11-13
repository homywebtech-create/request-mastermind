-- Fix security warning: Set search_path for the trigger function
CREATE OR REPLACE FUNCTION prevent_inconsistent_order_states()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Rule 1: Clear tracking_stage when status is cancelled
  IF NEW.status = 'cancelled' THEN
    NEW.tracking_stage := NULL;
    NEW.waiting_started_at := NULL;
    NEW.waiting_ends_at := NULL;
    RAISE NOTICE 'Trigger: Cleared tracking and waiting fields for cancelled order %', NEW.order_number;
  END IF;

  -- Rule 2: Clear waiting times when tracking_stage is 'working'
  IF NEW.tracking_stage = 'working' THEN
    NEW.waiting_started_at := NULL;
    NEW.waiting_ends_at := NULL;
    RAISE NOTICE 'Trigger: Cleared waiting times for order % entering working stage', NEW.order_number;
  END IF;

  -- Rule 3: Set status to completed when tracking_stage is payment_received
  IF NEW.tracking_stage = 'payment_received' AND NEW.status != 'completed' THEN
    NEW.status := 'completed';
    RAISE NOTICE 'Trigger: Set status to completed for order % with payment received', NEW.order_number;
  END IF;

  -- Rule 4: Set tracking_stage to payment_received when status is completed (if not already set)
  IF NEW.status = 'completed' AND NEW.tracking_stage != 'payment_received' AND NEW.tracking_stage IS NOT NULL THEN
    NEW.tracking_stage := 'payment_received';
    RAISE NOTICE 'Trigger: Set tracking_stage to payment_received for completed order %', NEW.order_number;
  END IF;

  -- Rule 5: Clear tracking_stage if status is pending
  IF NEW.status = 'pending' AND NEW.tracking_stage IS NOT NULL THEN
    NEW.tracking_stage := NULL;
    NEW.waiting_started_at := NULL;
    NEW.waiting_ends_at := NULL;
    RAISE NOTICE 'Trigger: Cleared tracking fields for pending order %', NEW.order_number;
  END IF;

  RETURN NEW;
END;
$$;