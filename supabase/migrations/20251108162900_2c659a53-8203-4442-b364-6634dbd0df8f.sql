-- إضافة حقول الموقع لجدول الطلبات
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS customer_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS customer_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS customer_location_address TEXT,
ADD COLUMN IF NOT EXISTS customer_location_name TEXT;