-- إضافة نظام لتتبع حالة انشغال المحترف ومنع استقبال طلبات جديدة

-- 1. إضافة عمود لتتبع حالة المحترف والطلب الحالي
ALTER TABLE specialists 
ADD COLUMN IF NOT EXISTS current_order_id uuid REFERENCES orders(id) ON DELETE SET NULL;

-- 2. إضافة index للبحث السريع
CREATE INDEX IF NOT EXISTS idx_specialists_current_order 
ON specialists(current_order_id) WHERE current_order_id IS NOT NULL;

-- 3. تحديث دالة التحقق من توفر المحترف لتشمل حالة الانشغال
CREATE OR REPLACE FUNCTION is_specialist_available_for_order(_specialist_id uuid, _order_id uuid)
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
  specialist_busy BOOLEAN;
BEGIN
  -- التحقق أولاً من أن المحترف ليس مشغولاً في طلب آخر
  SELECT (current_order_id IS NOT NULL AND current_order_id != _order_id)
  INTO specialist_busy
  FROM specialists
  WHERE id = _specialist_id;
  
  IF specialist_busy THEN
    RETURN FALSE;
  END IF;
  
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
    BEGIN
      order_start_time := (order_date || ' ' || order_time || ':00')::TIMESTAMP WITH TIME ZONE;
    EXCEPTION WHEN OTHERS THEN
      order_start_time := (order_date || ' 08:00:00')::TIMESTAMP WITH TIME ZONE;
    END;
  END IF;
  
  order_end_time := order_start_time + (hours_numeric || ' hours')::INTERVAL;
  
  -- Check if specialist has any conflicting schedule
  RETURN NOT EXISTS (
    SELECT 1
    FROM specialist_schedules
    WHERE specialist_id = _specialist_id
      AND (
        (order_start_time, order_end_time) OVERLAPS (start_time, end_time)
        OR
        order_start_time < (end_time + INTERVAL '1 minute' * COALESCE(travel_buffer_minutes, 120))
        AND order_start_time >= end_time
        OR
        order_end_time > (start_time - INTERVAL '1 minute' * COALESCE(travel_buffer_minutes, 120))
        AND order_end_time <= start_time
      )
  );
END;
$$;

-- 4. إنشاء دالة لتحديث حالة المحترف
CREATE OR REPLACE FUNCTION update_specialist_busy_status()
RETURNS TRIGGER AS $$
BEGIN
  -- عندما يتم تحديث tracking_stage للطلب
  IF NEW.tracking_stage IS NOT NULL AND NEW.tracking_stage IN ('moving', 'arrived', 'working', 'invoice_details') THEN
    -- تحديد المحترف كمشغول بهذا الطلب
    UPDATE specialists
    SET current_order_id = NEW.id
    WHERE id = NEW.specialist_id
      AND (current_order_id IS NULL OR current_order_id = NEW.id);
  END IF;
  
  -- عندما يتم إنهاء الطلب (completed أو cancelled)
  IF NEW.status IN ('completed', 'cancelled') OR NEW.tracking_stage = 'payment_received' THEN
    -- تحرير المحترف
    UPDATE specialists
    SET current_order_id = NULL
    WHERE id = NEW.specialist_id
      AND current_order_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. إضافة trigger لتحديث حالة المحترف تلقائياً
DROP TRIGGER IF EXISTS update_specialist_status_on_order_change ON orders;
CREATE TRIGGER update_specialist_status_on_order_change
  AFTER UPDATE OF tracking_stage, status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_specialist_busy_status();

-- 6. دالة للتحقق من حالة انشغال المحترف
CREATE OR REPLACE FUNCTION is_specialist_busy(_specialist_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT current_order_id IS NOT NULL
  FROM specialists
  WHERE id = _specialist_id;
$$;