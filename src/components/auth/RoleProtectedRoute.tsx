import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/contexts/UserRoleContext";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Permission } from "@/config/permissions";
import { useLanguage } from "@/hooks/useLanguage";

interface RoleProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: Permission;
  fallbackPath?: string;
}

export function RoleProtectedRoute({ 
  children, 
  requiredPermission,
  fallbackPath = "/auth" 
}: RoleProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const { hasPermission, permissions, loading: permsLoading } = useUserPermissions(user?.id, role);
  const { language } = useLanguage();

  console.log('RoleProtectedRoute - State:', {
    user: user?.id,
    role,
    permissions,
    requiredPermission,
    authLoading,
    roleLoading,
    permsLoading,
    hasPermission: requiredPermission ? hasPermission(requiredPermission) : 'N/A'
  });

  // Show loading spinner while checking auth, role, and permissions
  if (authLoading || roleLoading || permsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Not authenticated - redirect to auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Check permission if required
  if (requiredPermission && !hasPermission(requiredPermission)) {
    console.log('RoleProtectedRoute - Access denied. Required:', requiredPermission, 'Available:', permissions);
    
    // Find first available page based on user permissions
    const redirectPriority = [
      { path: '/admin', permission: 'view_orders' as const },
      { path: '/orders', permission: 'view_orders' as const },
      { path: '/companies', permission: 'view_companies' as const },
      { path: '/admin/specialists', permission: 'view_specialists' as const },
      { path: '/services', permission: 'view_services' as const },
      { path: '/contracts', permission: 'view_contracts' as const },
      { path: '/admin/users', permission: 'manage_users' as const },
      { path: '/deletion-requests', permission: 'view_deletion_requests' as const },
      { path: '/admin/activity', permission: 'view_activity_logs' as const },
    ];

    // Find first available page
    for (const { path, permission } of redirectPriority) {
      if (hasPermission(permission)) {
        return <Navigate to={path} replace />;
      }
    }

    // If no permissions available, show error
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-6xl">🔒</div>
          <h2 className="text-2xl font-bold">
            {language === 'ar' ? 'غير مصرح' : 'Access Denied'}
          </h2>
          <p className="text-muted-foreground">
            {language === 'ar' 
              ? 'ليس لديك صلاحية للوصول إلى أي صفحة. يرجى التواصل مع المدير.'
              : 'You don\'t have permission to access any page. Please contact the administrator.'}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
