
-- Add view_statistics to company_permission enum
ALTER TYPE company_permission ADD VALUE IF NOT EXISTS 'view_statistics';
