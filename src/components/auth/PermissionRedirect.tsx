import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/contexts/UserRoleContext";
import { useUserPermissions } from "@/hooks/useUserPermissions";

/**
 * Component to redirect users to their first available page based on permissions
 */
export function PermissionRedirect() {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const { hasPermission, loading: permsLoading } = useUserPermissions(user?.id, role);
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || roleLoading || permsLoading) return;

    // Define priority order of pages to redirect to
    const redirectPriority = [
      { path: '/admin', permission: 'view_dashboard' as const },
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
        navigate(path, { replace: true });
        return;
      }
    }

    // If no permissions match, redirect to auth
    navigate('/auth', { replace: true });
  }, [authLoading, roleLoading, permsLoading, hasPermission, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
}
