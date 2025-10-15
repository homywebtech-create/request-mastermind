-- إضافة RLS policies لـ bucket id-cards للسماح برفع الصور أثناء التسجيل

-- السماح للجميع برفع الصور إلى id-cards bucket
CREATE POLICY "Anyone can upload to id-cards during registration"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'id-cards');

-- السماح للـ admins بقراءة جميع الصور
CREATE POLICY "Admins can view all id-cards"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'id-cards' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- السماح للشركات بقراءة صور المتخصصين التابعين لهم
CREATE POLICY "Companies can view their specialists id-cards"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'id-cards'
  AND EXISTS (
    SELECT 1
    FROM specialists s
    JOIN profiles p ON p.company_id = s.company_id
    WHERE p.user_id = auth.uid()
    AND (storage.foldername(name))[1] = s.id::text
  )
);

-- السماح للـ admins بحذف الصور
CREATE POLICY "Admins can delete id-cards"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'id-cards'
  AND has_role(auth.uid(), 'admin'::app_role)
);