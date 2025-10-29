import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyUserPermissions } from "@/hooks/useCompanyUserPermissions";
import { CompanyPermission } from "@/config/companyPermissions";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

interface CompanyPermissionGuardProps {
  children: ReactNode;
  permission?: CompanyPermission;
  anyPermissions?: CompanyPermission[];
  allPermissions?: CompanyPermission[];
  fallback?: ReactNode;
}

export function CompanyPermissionGuard({ 
  children, 
  permission, 
  anyPermissions,
  allPermissions,
  fallback 
}: CompanyPermissionGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading: permsLoading, isOwner } = useCompanyUserPermissions(user?.id);
  const { language } = useLanguage();

  // Show loader while checking
  if (authLoading || permsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Owners have full access
  if (isOwner) {
    return <>{children}</>;
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
