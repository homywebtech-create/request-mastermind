-- Add new fields to orders table for booking details
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS gps_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS gps_longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS building_info TEXT,
ADD COLUMN IF NOT EXISTS selected_booking_type TEXT,
ADD COLUMN IF NOT EXISTS booking_date DATE,
ADD COLUMN IF NOT EXISTS booking_date_type TEXT CHECK (booking_date_type IN ('today', 'tomorrow', 'custom'));

-- Add comment for documentation
COMMENT ON COLUMN public.orders.gps_latitude IS 'GPS latitude coordinate for service location';
COMMENT ON COLUMN public.orders.gps_longitude IS 'GPS longitude coordinate for service location';
COMMENT ON COLUMN public.orders.building_info IS 'Building information and address details';
COMMENT ON COLUMN public.orders.selected_booking_type IS 'Type of booking: once, weekly, bi-weekly, or monthly';
COMMENT ON COLUMN public.orders.booking_date IS 'Selected booking date';
COMMENT ON COLUMN public.orders.booking_date_type IS 'Type of booking date: today, tomorrow, or custom';