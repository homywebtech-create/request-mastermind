-- Drop old constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add new constraint with 'upcoming' status
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'awaiting-response'::text, 'upcoming'::text, 'in-progress'::text, 'completed'::text, 'cancelled'::text]));