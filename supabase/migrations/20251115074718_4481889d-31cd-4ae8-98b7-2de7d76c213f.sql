-- Drop the existing policy for specialists viewing their assigned orders
DROP POLICY IF EXISTS "Specialists can view their assigned orders" ON orders;

-- Create updated policy that excludes orders where specialist rejected readiness
CREATE POLICY "Specialists can view their assigned orders"
ON orders
FOR SELECT
USING (
  specialist_id IN (
    SELECT s.id
    FROM specialists s
    JOIN profiles p ON p.phone = s.phone
    WHERE p.user_id = auth.uid()
  )
  AND (
    specialist_readiness_status IS NULL 
    OR specialist_readiness_status != 'not_ready'
  )
);

-- Also update the policy for updating orders to prevent rejected specialists from updating
DROP POLICY IF EXISTS "Specialists can update their company orders" ON orders;

CREATE POLICY "Specialists can update their company orders"
ON orders
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND (
      (profiles.company_id = orders.company_id)
      OR (orders.send_to_all_companies = true)
    )
  )
  -- Additional check: if order is assigned to this specialist and they rejected, block updates
  AND NOT (
    orders.specialist_id IN (
      SELECT s.id
      FROM specialists s
      JOIN profiles p ON p.phone = s.phone
      WHERE p.user_id = auth.uid()
    )
    AND orders.specialist_readiness_status = 'not_ready'
  )
);