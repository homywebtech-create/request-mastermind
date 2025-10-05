-- Add rejection tracking to order_specialists
ALTER TABLE public.order_specialists
ADD COLUMN is_accepted BOOLEAN DEFAULT NULL,
ADD COLUMN rejected_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN rejection_reason TEXT;

-- Add comments
COMMENT ON COLUMN order_specialists.is_accepted IS 'true = مقبول, false = مرفوض, null = قيد الانتظار';
COMMENT ON COLUMN order_specialists.rejected_at IS 'وقت رفض العرض';
COMMENT ON COLUMN order_specialists.rejection_reason IS 'سبب رفض العرض (مثل: السعر غير منافس، تقييم منخفض، الخ)';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_order_specialists_status 
ON order_specialists(specialist_id, is_accepted, quoted_at);