-- Fix orders where booking is confirmed but no specialist accepted
-- Auto-accept the specialist with lowest quote for such orders

UPDATE order_specialists
SET 
  is_accepted = true,
  rejected_at = null,
  rejection_reason = null
WHERE id IN (
  -- Find order_specialists with quotes but not accepted yet, where order has booking_date
  SELECT os.id
  FROM order_specialists os
  INNER JOIN orders o ON o.id = os.order_id
  WHERE os.quoted_price IS NOT NULL
    AND os.is_accepted IS NULL
    AND o.booking_date IS NOT NULL
    AND NOT EXISTS (
      -- Make sure no other specialist is already accepted for this order
      SELECT 1 FROM order_specialists os2
      WHERE os2.order_id = os.order_id
      AND os2.is_accepted = true
    )
    AND os.id IN (
      -- Select only the specialist with lowest price for each order
      SELECT DISTINCT ON (os3.order_id) os3.id
      FROM order_specialists os3
      WHERE os3.quoted_price IS NOT NULL
      AND os3.is_accepted IS NULL
      ORDER BY os3.order_id, 
        CAST(REGEXP_REPLACE(os3.quoted_price, '[^0-9.]', '', 'g') AS NUMERIC) ASC
    )
);

-- Reject other specialists for these orders
UPDATE order_specialists
SET 
  is_accepted = false,
  rejected_at = NOW(),
  rejection_reason = 'تم اختيار عرض آخر'
WHERE order_id IN (
  SELECT DISTINCT o.id
  FROM orders o
  INNER JOIN order_specialists os ON os.order_id = o.id
  WHERE o.booking_date IS NOT NULL
    AND os.is_accepted = true
)
AND is_accepted IS NULL
AND quoted_price IS NOT NULL;