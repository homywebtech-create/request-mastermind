import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/contexts/UserRoleContext";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Permission } from "@/config/permissions";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

interface PermissionGuardProps {
  children: ReactNode;
  permission?: Permission;
  anyPermissions?: Permission[];
  allPermissions?: Permission[];
  fallback?: ReactNode;
}

export function PermissionGuard({ 
  children, 
  permission, 
  anyPermissions,
  allPermissions,
  fallback 
}: PermissionGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading: permsLoading } = useUserPermissions(user?.id, role);
  const { language } = useLanguage();

  // Show loader while checking
  if (authLoading || roleLoading || permsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Check permissions
  let hasAccess = false;

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (anyPermissions) {
    hasAccess = hasAnyPermission(anyPermissions);
  } else if (allPermissions) {
    hasAccess = hasAllPermissions(allPermissions);
  }

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="text-6xl">🔒</div>
          <h2 className="text-2xl font-bold">
            {language === 'ar' ? 'غير مصرح' : 'Access Denied'}
          </h2>
          <p className="text-muted-foreground">
            {language === 'ar' 
              ? 'ليس لديك صلاحية للوصول إلى هذا القسم'
              : 'You do not have permission to access this section'}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
