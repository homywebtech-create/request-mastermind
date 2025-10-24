-- Create function to check if specialist is available for an order
CREATE OR REPLACE FUNCTION public.is_specialist_available_for_order(
  _specialist_id uuid,
  _order_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_start_time TIMESTAMP WITH TIME ZONE;
  order_end_time TIMESTAMP WITH TIME ZONE;
  order_date DATE;
  order_time TEXT;
  order_hours TEXT;
  hours_numeric INTEGER;
BEGIN
  -- Get order details
  SELECT booking_date, booking_time, hours_count
  INTO order_date, order_time, order_hours
  FROM orders
  WHERE id = _order_id;
  
  -- If no booking date/time, order is visible (not scheduled yet)
  IF order_date IS NULL OR order_time IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Parse hours count (default to 4 if null or invalid)
  BEGIN
    hours_numeric := COALESCE(CAST(order_hours AS INTEGER), 4);
  EXCEPTION WHEN OTHERS THEN
    hours_numeric := 4;
  END;
  
  -- Calculate start time based on booking time
  IF order_time = 'morning' THEN
    order_start_time := (order_date || ' 08:00:00')::TIMESTAMP WITH TIME ZONE;
  ELSIF order_time = 'afternoon' THEN
    order_start_time := (order_date || ' 14:00:00')::TIMESTAMP WITH TIME ZONE;
  ELSIF order_time = 'evening' THEN
    order_start_time := (order_date || ' 18:00:00')::TIMESTAMP WITH TIME ZONE;
  ELSE
    -- Assume it's a specific time (e.g., "08:00")
    BEGIN
      order_start_time := (order_date || ' ' || order_time || ':00')::TIMESTAMP WITH TIME ZONE;
    EXCEPTION WHEN OTHERS THEN
      -- Default to morning if parsing fails
      order_start_time := (order_date || ' 08:00:00')::TIMESTAMP WITH TIME ZONE;
    END;
  END IF;
  
  -- Calculate end time
  order_end_time := order_start_time + (hours_numeric || ' hours')::INTERVAL;
  
  -- Check if specialist has any conflicting schedule
  -- Including travel buffer time (default 120 minutes)
  RETURN NOT EXISTS (
    SELECT 1
    FROM specialist_schedules
    WHERE specialist_id = _specialist_id
      AND (
        -- New booking overlaps with existing booking
        (order_start_time, order_end_time) OVERLAPS (start_time, end_time)
        OR
        -- New booking is within buffer time after existing booking
        order_start_time < (end_time + INTERVAL '1 minute' * COALESCE(travel_buffer_minutes, 120))
        AND order_start_time >= end_time
        OR
        -- New booking is within buffer time before existing booking
        order_end_time > (start_time - INTERVAL '1 minute' * COALESCE(travel_buffer_minutes, 120))
        AND order_end_time <= start_time
      )
  );
END;
$$;

-- Update RLS policy for specialists viewing orders
DROP POLICY IF EXISTS "Specialists can view their company orders" ON orders;

CREATE POLICY "Specialists can view available company orders"
ON orders
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN specialists s ON s.phone = p.phone AND s.company_id = p.company_id
    WHERE p.user_id = auth.uid()
      AND (orders.company_id = p.company_id OR orders.send_to_all_companies = true)
      AND public.is_specialist_available_for_order(s.id, orders.id)
  )
);