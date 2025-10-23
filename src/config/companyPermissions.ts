// Define all available permissions for company users
export type CompanyPermission = 
  | 'manage_specialists'
  | 'view_specialists'
  | 'manage_orders'
  | 'view_orders'
  | 'manage_contracts'
  | 'view_contracts'
  | 'manage_team'
  | 'view_reports';

/**
 * Get permission display name
 */
export function getCompanyPermissionDisplayName(
  permission: CompanyPermission, 
  language: 'ar' | 'en' = 'ar'
): string {
  const names: Record<CompanyPermission, { ar: string; en: string }> = {
    manage_specialists: { ar: 'إدارة المحترفات', en: 'Manage Specialists' },
    view_specialists: { ar: 'عرض المحترفات', en: 'View Specialists' },
    manage_orders: { ar: 'إدارة الطلبات', en: 'Manage Orders' },
    view_orders: { ar: 'عرض الطلبات', en: 'View Orders' },
    manage_contracts: { ar: 'إدارة العقود', en: 'Manage Contracts' },
    view_contracts: { ar: 'عرض العقود', en: 'View Contracts' },
    manage_team: { ar: 'إدارة الفريق', en: 'Manage Team' },
    view_reports: { ar: 'عرض التقارير', en: 'View Reports' },
  };
  
  return names[permission][language];
}

/**
 * Check if user is company owner (full access)
 */
export function isCompanyOwner(isOwner: boolean | undefined): boolean {
  return isOwner === true;
}
