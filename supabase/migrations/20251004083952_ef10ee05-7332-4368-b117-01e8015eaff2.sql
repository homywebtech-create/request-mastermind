-- السماح للمستخدمين بقراءة أكواد التحقق الخاصة بهم للتحقق منها
CREATE POLICY "Anyone can read their own verification codes for verification"
ON public.verification_codes
FOR SELECT
USING (
  verified = false 
  AND expires_at > now()
  AND attempts < 5
);