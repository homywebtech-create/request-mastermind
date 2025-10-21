import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Permission, hasPermission } from "@/config/permissions";

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
  const { role, loading: roleLoading } = useUserRole(user?.id);

  // Show loading spinner while checking auth and role
  if (authLoading || roleLoading) {
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
  if (requiredPermission && !hasPermission(role, requiredPermission)) {
    // Prevent infinite redirect loop - if already at fallback, show error instead
    if (window.location.pathname === fallbackPath) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
            <p className="text-muted-foreground">You don't have permission to access this page.</p>
          </div>
        </div>
      );
    }
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}
