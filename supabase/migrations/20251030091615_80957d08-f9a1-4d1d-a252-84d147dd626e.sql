
-- Add RLS policy to allow specialists to view orders assigned directly to them
CREATE POLICY "Specialists can view their assigned orders"
ON orders
FOR SELECT
TO authenticated
USING (
  specialist_id IN (
    SELECT s.id 
    FROM specialists s
    JOIN profiles p ON p.phone = s.phone
    WHERE p.user_id = auth.uid()
  )
);
