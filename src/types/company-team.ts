export interface CompanyUser {
  id: string;
  company_id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  is_owner: boolean;
  created_at: string;
  permissions: string[];
}