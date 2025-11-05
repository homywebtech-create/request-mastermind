-- Add specialist readiness tracking fields to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS specialist_readiness_status text CHECK (specialist_readiness_status IN ('pending', 'ready', 'not_ready')),
ADD COLUMN IF NOT EXISTS specialist_readiness_response_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS specialist_not_ready_reason text,
ADD COLUMN IF NOT EXISTS readiness_check_sent_at timestamp with time zone;

-- Add comment for documentation
COMMENT ON COLUMN orders.specialist_readiness_status IS 'Tracks if specialist confirmed readiness 1 hour before booking: pending, ready, not_ready';
COMMENT ON COLUMN orders.specialist_readiness_response_at IS 'When specialist responded to readiness check';
COMMENT ON COLUMN orders.specialist_not_ready_reason IS 'Reason if specialist is not ready';
COMMENT ON COLUMN orders.readiness_check_sent_at IS 'When readiness check notification was sent';