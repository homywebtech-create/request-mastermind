-- تحديث سياسة التحديث للسماح بوضع علامة verified عند التحقق من الكود
DROP POLICY IF EXISTS "Users can verify codes with security checks" ON public.verification_codes;

CREATE POLICY "Users can mark codes as verified during verification"
ON public.verification_codes
FOR UPDATE
USING (
  verified = false 
  AND expires_at > now() 
  AND attempts < 5
)
WITH CHECK (
  verified = true
);