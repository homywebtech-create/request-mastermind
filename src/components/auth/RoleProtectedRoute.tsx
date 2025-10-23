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
  anyPermissions?: Permission[];
  fallbackPath?: string;
}

export function RoleProtectedRoute({ 
  children, 
  requiredPermission,
  anyPermissions,
  fallbackPath = "/auth" 
}: RoleProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const { hasPermission, hasAnyPermission, permissions, loading: permsLoading } = useUserPermissions(user?.id, role);
  const { language } = useLanguage();

  console.log('RoleProtectedRoute - State:', {
    user: user?.id,
    role,
    permissions,
    requiredPermission,
    anyPermissions,
    authLoading,
    roleLoading,
    permsLoading,
    hasPermission: requiredPermission ? hasPermission(requiredPermission) : 'N/A',
    hasAnyPermission: anyPermissions ? hasAnyPermission(anyPermissions) : 'N/A'
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

    // If no permissions available, show error with logout option
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="text-6xl">🔒</div>
          <h2 className="text-2xl font-bold">
            {language === 'ar' ? 'غير مصرح' : 'Access Denied'}
          </h2>
          <p className="text-muted-foreground">
            {language === 'ar' 
              ? 'ليس لديك صلاحية للوصول إلى أي صفحة. يرجى التواصل مع المدير.'
              : 'You don\'t have permission to access any page. Please contact the administrator.'}
          </p>
          <div className="flex flex-col gap-3 mt-6">
            <button
              onClick={() => {
                import("@/integrations/supabase/client").then(({ supabase }) => {
                  supabase.auth.signOut().then(() => {
                    window.location.href = '/auth';
                  });
                });
              }}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              {language === 'ar' ? 'تسجيل الخروج' : 'Logout'}
            </button>
            <a
              href="/company-auth"
              className="px-6 py-3 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors inline-block"
            >
              {language === 'ar' ? 'تسجيل دخول كشركة' : 'Login as Company'}
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Check anyPermissions if specified
  if (anyPermissions && !hasAnyPermission(anyPermissions)) {
    console.log('RoleProtectedRoute - Access denied. Required any of:', anyPermissions, 'Available:', permissions);
    
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

    // If no permissions available, show error with logout option
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="text-6xl">🔒</div>
          <h2 className="text-2xl font-bold">
            {language === 'ar' ? 'غير مصرح' : 'Access Denied'}
          </h2>
          <p className="text-muted-foreground">
            {language === 'ar' 
              ? 'ليس لديك صلاحية للوصول إلى أي صفحة. يرجى التواصل مع المدير.'
              : 'You don\'t have permission to access any page. Please contact the administrator.'}
          </p>
          <div className="flex flex-col gap-3 mt-6">
            <button
              onClick={() => {
                import("@/integrations/supabase/client").then(({ supabase }) => {
                  supabase.auth.signOut().then(() => {
                    window.location.href = '/auth';
                  });
                });
              }}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              {language === 'ar' ? 'تسجيل الخروج' : 'Logout'}
            </button>
            <a
              href="/company-auth"
              className="px-6 py-3 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors inline-block"
            >
              {language === 'ar' ? 'تسجيل دخول كشركة' : 'Login as Company'}
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
