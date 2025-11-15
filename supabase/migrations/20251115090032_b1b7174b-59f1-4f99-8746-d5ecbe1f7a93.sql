
-- Drop existing policies first
DROP POLICY IF EXISTS "Specialists can view their own order records" ON order_specialists;

-- Re-create the specialist policy
CREATE POLICY "Specialists can view their own order records"
ON order_specialists
FOR SELECT
USING (
  specialist_id IN (
    SELECT s.id
    FROM specialists s
    JOIN profiles p ON p.phone = s.phone
    WHERE p.user_id = auth.uid()
  )
);
