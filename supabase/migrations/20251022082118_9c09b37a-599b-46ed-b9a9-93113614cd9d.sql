-- Create specialist_schedules table to track bookings and availability
CREATE TABLE IF NOT EXISTS public.specialist_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES public.specialists(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  travel_buffer_minutes INTEGER DEFAULT 120, -- 2 hours buffer between tasks
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Create index for faster queries
CREATE INDEX idx_specialist_schedules_specialist_id ON public.specialist_schedules(specialist_id);
CREATE INDEX idx_specialist_schedules_times ON public.specialist_schedules(start_time, end_time);

-- Enable RLS
ALTER TABLE public.specialist_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view all schedules"
  ON public.specialist_schedules
  FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert schedules"
  ON public.specialist_schedules
  FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update schedules"
  ON public.specialist_schedules
  FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete schedules"
  ON public.specialist_schedules
  FOR DELETE
  USING (is_admin(auth.uid()));

CREATE POLICY "Companies can view their specialists schedules"
  ON public.specialist_schedules
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM specialists s
      JOIN profiles p ON p.company_id = s.company_id
      WHERE s.id = specialist_schedules.specialist_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Public can view schedules for booking availability"
  ON public.specialist_schedules
  FOR SELECT
  USING (true);

-- Function to check if a specialist is available at a given time
CREATE OR REPLACE FUNCTION public.is_specialist_available(
  _specialist_id UUID,
  _start_time TIMESTAMP WITH TIME ZONE,
  _end_time TIMESTAMP WITH TIME ZONE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if there's any conflicting schedule
  -- Including travel buffer time (2 hours before and after)
  RETURN NOT EXISTS (
    SELECT 1
    FROM public.specialist_schedules
    WHERE specialist_id = _specialist_id
      AND (
        -- New booking overlaps with existing booking
        (_start_time, _end_time) OVERLAPS (start_time, end_time)
        OR
        -- New booking is within buffer time after existing booking
        _start_time < (end_time + INTERVAL '1 minute' * travel_buffer_minutes)
        AND _start_time >= end_time
        OR
        -- New booking is within buffer time before existing booking
        _end_time > (start_time - INTERVAL '1 minute' * travel_buffer_minutes)
        AND _end_time <= start_time
      )
  );
END;
$$;

-- Function to get next available time for a specialist
CREATE OR REPLACE FUNCTION public.get_next_available_time(
  _specialist_id UUID,
  _duration_hours INTEGER DEFAULT 4
)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_time TIMESTAMP WITH TIME ZONE;
  latest_end TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get the latest end time from schedules
  SELECT MAX(end_time + INTERVAL '1 minute' * travel_buffer_minutes)
  INTO latest_end
  FROM public.specialist_schedules
  WHERE specialist_id = _specialist_id
    AND end_time > now();
  
  -- If no future bookings, available now
  IF latest_end IS NULL THEN
    RETURN now();
  END IF;
  
  -- Return the time after the latest booking plus buffer
  RETURN latest_end;
END;
$$;

-- Trigger to update updated_at
CREATE TRIGGER update_specialist_schedules_updated_at
  BEFORE UPDATE ON public.specialist_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();