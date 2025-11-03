-- Add policy for companies to view their specialists' device tokens
CREATE POLICY "Companies can view their specialists device tokens"
ON device_tokens
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM specialists s
    JOIN profiles p ON p.company_id = s.company_id
    WHERE s.id = device_tokens.specialist_id
    AND p.user_id = auth.uid()
  )
);