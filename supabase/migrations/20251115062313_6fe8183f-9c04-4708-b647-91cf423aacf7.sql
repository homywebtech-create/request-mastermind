-- Add field to track when specialist viewed the readiness notification
ALTER TABLE orders 
ADD COLUMN readiness_notification_viewed_at TIMESTAMP WITH TIME ZONE;

-- Add index for better query performance
CREATE INDEX idx_orders_readiness_viewed ON orders(readiness_notification_viewed_at) 
WHERE readiness_notification_viewed_at IS NOT NULL;

COMMENT ON COLUMN orders.readiness_notification_viewed_at IS 'Timestamp when specialist opened/viewed the readiness check notification';