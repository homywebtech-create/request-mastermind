-- Add new admin role types to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_full';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_viewer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_manager';