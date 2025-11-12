-- Add early_finish_reason column to orders table
ALTER TABLE orders 
ADD COLUMN early_finish_reason text;

COMMENT ON COLUMN orders.early_finish_reason IS 'Reason for finishing work before scheduled time';