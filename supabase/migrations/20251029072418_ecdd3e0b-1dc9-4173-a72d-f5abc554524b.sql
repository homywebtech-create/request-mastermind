-- Add fields to track order cancellation details
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS cancelled_by TEXT,
ADD COLUMN IF NOT EXISTS cancelled_by_role TEXT CHECK (cancelled_by_role IN ('customer', 'specialist', 'admin', 'company')),
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;

-- Add comment to explain the fields
COMMENT ON COLUMN public.orders.cancelled_by IS 'Name of the person who cancelled the order';
COMMENT ON COLUMN public.orders.cancelled_by_role IS 'Role of who cancelled: customer, specialist, admin, or company';
COMMENT ON COLUMN public.orders.cancellation_reason IS 'Reason for cancellation';
COMMENT ON COLUMN public.orders.cancelled_at IS 'Timestamp when order was cancelled';