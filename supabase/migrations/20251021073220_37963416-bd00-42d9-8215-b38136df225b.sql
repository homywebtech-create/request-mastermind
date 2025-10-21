-- Fix Error #1: Remove public access to specialists PII
-- This prevents unauthorized data harvesting of worker information
DROP POLICY IF EXISTS "Anyone can verify active specialists for authentication" ON specialists;

-- Fix Error #2: Restrict service catalog to admin-only access
-- Prevents any authenticated user from corrupting the service catalog
DROP POLICY IF EXISTS "Authenticated users can manage services" ON services;
DROP POLICY IF EXISTS "Authenticated users can manage sub_services" ON sub_services;

CREATE POLICY "Only admins can manage services"
ON services FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can manage sub_services"
ON sub_services FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Note: Public SELECT policies for active services remain in place for viewing