import { UserRole } from "@/hooks/useUserRole";

// Define all available permissions in the system
export type Permission = 
  | 'view_dashboard'
  | 'view_orders'
  | 'manage_orders'
  | 'view_companies'
  | 'manage_companies'
  | 'view_specialists'
  | 'manage_specialists'
  | 'view_services'
  | 'manage_services'
  | 'view_contracts'
  | 'manage_contracts'
  | 'view_deletion_requests'
  | 'manage_deletion_requests'
  | 'view_users'
  | 'manage_users'
  | 'view_activity_logs';

// Role to permissions mapping
const rolePermissions: Record<NonNullable<UserRole>, Permission[]> = {
  // Super admin - full access
  admin_full: [
    'view_dashboard',
    'view_orders',
    'manage_orders',
    'view_companies',
    'manage_companies',
    'view_specialists',
    'manage_specialists',
    'view_services',
    'manage_services',
    'view_contracts',
    'manage_contracts',
    'view_deletion_requests',
    'manage_deletion_requests',
    'view_users',
    'manage_users',
    'view_activity_logs',
  ],
  
  // Manager - can manage most things except users
  admin_manager: [
    'view_dashboard',
    'view_orders',
    'manage_orders',
    'view_companies',
    'manage_companies',
    'view_specialists',
    'manage_specialists',
    'view_services',
    'manage_services',
    'view_contracts',
    'manage_contracts',
    'view_deletion_requests',
    'manage_deletion_requests',
    'view_activity_logs',
  ],
  
  // Regular admin - basic management
  admin: [
    'view_dashboard',
    'view_orders',
    'manage_orders',
    'view_companies',
    'view_specialists',
    'view_services',
    'view_contracts',
    'view_deletion_requests',
  ],
  
  // Viewer - read-only access
  admin_viewer: [
    'view_dashboard',
    'view_orders',
    'view_companies',
    'view_specialists',
    'view_services',
    'view_contracts',
    'view_deletion_requests',
    'view_activity_logs',
  ],
  
  // Specialist role (not admin)
  specialist: [],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole | null, permission: Permission): boolean {
  if (!role) return false;
  const permissions = rolePermissions[role];
  return permissions ? permissions.includes(permission) : false;
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: UserRole | null, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p));
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: UserRole | null, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(role, p));
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole | null): Permission[] {
  if (!role) return [];
  return rolePermissions[role] || [];
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole | null, language: 'ar' | 'en' = 'ar'): string {
  if (!role) return '';
  
  const names = {
    admin_full: language === 'ar' ? 'مدير كامل الصلاحيات' : 'Full Admin',
    admin_manager: language === 'ar' ? 'مدير عام' : 'Manager',
    admin: language === 'ar' ? 'مدير' : 'Admin',
    admin_viewer: language === 'ar' ? 'مشاهد فقط' : 'Viewer',
    specialist: language === 'ar' ? 'محترفة' : 'Specialist',
  };
  
  return names[role] || role;
}
