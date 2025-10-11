-- Create activity logs table to track all actions
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  details jsonb,
  ip_address text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on activity_logs
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all activity logs
CREATE POLICY "Admins can view all activity logs"
ON public.activity_logs
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'admin_full'::app_role) OR 
  has_role(auth.uid(), 'admin_viewer'::app_role) OR
  has_role(auth.uid(), 'admin_manager'::app_role)
);

-- Only system can insert activity logs
CREATE POLICY "System can insert activity logs"
ON public.activity_logs
FOR INSERT
WITH CHECK (true);

-- Add modified_by to orders table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'modified_by'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN modified_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Create function to log activity
CREATE OR REPLACE FUNCTION public.log_activity(
  _action_type text,
  _resource_type text,
  _resource_id uuid DEFAULT NULL,
  _details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.activity_logs (
    user_id,
    action_type,
    resource_type,
    resource_id,
    details
  ) VALUES (
    auth.uid(),
    _action_type,
    _resource_type,
    _resource_id,
    _details
  );
END;
$$;

-- Create trigger to log order updates
CREATE OR REPLACE FUNCTION public.log_order_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_activity('order_created', 'order', NEW.id, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.modified_by = auth.uid();
    PERFORM log_activity(
      'order_updated',
      'order',
      NEW.id,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'changes', to_jsonb(NEW)
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for orders
DROP TRIGGER IF EXISTS log_order_changes_trigger ON public.orders;
CREATE TRIGGER log_order_changes_trigger
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.log_order_changes();

-- Update user_roles policies to include new admin roles
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'admin_full'::app_role)
);

-- Create function to check if user has any admin role
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('admin'::app_role, 'admin_full'::app_role, 'admin_manager'::app_role, 'admin_viewer'::app_role)
  )
$$;

-- Update orders policies for different admin roles
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
CREATE POLICY "Admins can view all orders"
ON public.orders
FOR SELECT
USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
CREATE POLICY "Admins can update orders"
ON public.orders
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'admin_full'::app_role) OR 
  has_role(auth.uid(), 'admin_manager'::app_role)
);