-- إضافة جدول لتخزين الصلاحيات المخصصة للمستخدمين
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, permission)
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Admins can view all permissions
CREATE POLICY "Admins can view all permissions"
ON public.user_permissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'admin_full', 'admin_manager', 'admin_viewer')
  )
);

-- Admins can insert permissions
CREATE POLICY "Admins can insert permissions"
ON public.user_permissions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'admin_full', 'admin_manager')
  )
);

-- Admins can delete permissions
CREATE POLICY "Admins can delete permissions"
ON public.user_permissions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'admin_full', 'admin_manager')
  )
);

-- Users can read their own permissions
CREATE POLICY "Users can read own permissions"
ON public.user_permissions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
