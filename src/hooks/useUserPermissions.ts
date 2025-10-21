import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Permission, getRolePermissions } from "@/config/permissions";
import { UserRole } from "./useUserRole";

export function useUserPermissions(userId: string | undefined, role: UserRole | null) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      try {
        // First, check if user has custom permissions
        const { data: customPermissions, error } = await supabase
          .from('user_permissions')
          .select('permission')
          .eq('user_id', userId);

        if (error) {
          console.error('Error fetching custom permissions:', error);
        }

        // If user has custom permissions, use them
        if (customPermissions && customPermissions.length > 0) {
          const perms = customPermissions.map(p => p.permission as Permission);
          setPermissions(perms);
        } else {
          // Otherwise, use role-based permissions
          const rolePerms = getRolePermissions(role);
          setPermissions(rolePerms);
        }
      } catch (error) {
        console.error('Error in useUserPermissions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [userId, role]);

  const hasPermission = (permission: Permission): boolean => {
    return permissions.includes(permission);
  };

  const hasAnyPermission = (requiredPermissions: Permission[]): boolean => {
    return requiredPermissions.some(p => permissions.includes(p));
  };

  const hasAllPermissions = (requiredPermissions: Permission[]): boolean => {
    return requiredPermissions.every(p => permissions.includes(p));
  };

  return {
    permissions,
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions
  };
}
