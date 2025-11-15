-- Update the policy to hide orders that specialist has rejected in order_specialists table
DROP POLICY IF EXISTS "Specialists can view available company orders" ON orders;

CREATE POLICY "Specialists can view available company orders"
ON orders
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN specialists s ON (s.phone = p.phone AND s.company_id = p.company_id)
    WHERE p.user_id = auth.uid()
    AND (
      (orders.company_id = p.company_id)
      OR (orders.send_to_all_companies = true)
    )
    AND is_specialist_available_for_order(s.id, orders.id)
    -- Exclude orders where this specialist has rejected in order_specialists
    AND NOT EXISTS (
      SELECT 1 
      FROM order_specialists os
      WHERE os.order_id = orders.id
      AND os.specialist_id = s.id
      AND (os.is_accepted = false OR os.rejected_at IS NOT NULL)
    )
  )
);