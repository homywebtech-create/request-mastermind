-- Add quoted_price column to order_specialists table
ALTER TABLE public.order_specialists
ADD COLUMN quoted_price TEXT,
ADD COLUMN quoted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN quote_notes TEXT;

-- Update order status enum to include new states
-- First check existing values
DO $$ 
BEGIN
  -- Add new status if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM ('pending', 'quoted', 'accepted', 'in_progress', 'completed', 'cancelled');
  END IF;
END $$;

-- Add comments for clarity
COMMENT ON COLUMN order_specialists.quoted_price IS 'السعر المقترح من المحترفة';
COMMENT ON COLUMN order_specialists.quoted_at IS 'وقت تقديم العرض';
COMMENT ON COLUMN order_specialists.quote_notes IS 'ملاحظات المحترفة على العرض';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_order_specialists_quoted 
ON order_specialists(order_id, quoted_at) 
WHERE quoted_price IS NOT NULL;