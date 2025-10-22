import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Permission, getRolePermissions } from "@/config/permissions";
import { UserRole } from "@/contexts/UserRoleContext";

export function useUserPermissions(userId: string | undefined, role: UserRole | null) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef<{ userId: string | undefined; role: UserRole | null } | null>(null);
  const isFetchingRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we already fetched for this user and role
    if (fetchedRef.current?.userId === userId && fetchedRef.current?.role === role) {
      return;
    }

    if (!userId) {
      console.log('useUserPermissions - No userId, clearing permissions');
      fetchedRef.current = { userId, role };
      setPermissions([]);
      setLoading(false);
      return;
    }

    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      return;
    }

    const fetchPermissions = async () => {
      isFetchingRef.current = true;
      console.log('useUserPermissions - Fetching for userId:', userId, 'role:', role);
      try {
        // First, check if user has custom permissions
        const { data: customPermissions, error } = await supabase
          .from('user_permissions')
          .select('permission')
          .eq('user_id', userId);

        console.log('useUserPermissions - Custom permissions query result:', { data: customPermissions, error });

        if (error) {
          console.error('Error fetching custom permissions:', error);
        }

        // If user has custom permissions, use them
        if (customPermissions && customPermissions.length > 0) {
          const perms = customPermissions.map(p => p.permission as Permission);
          console.log('useUserPermissions - Using custom permissions:', perms);
          setPermissions(perms);
        } else {
          // Otherwise, use role-based permissions
          const rolePerms = getRolePermissions(role);
          console.log('useUserPermissions - Using role-based permissions:', rolePerms, 'for role:', role);
          setPermissions(rolePerms);
        }

        // Mark this userId and role as fetched
        fetchedRef.current = { userId, role };
      } catch (error) {
        console.error('Error in useUserPermissions:', error);
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    };

    fetchPermissions();

    // Subscribe to realtime changes in user_permissions
    if (userId) {
      const channel = supabase
        .channel(`user-permissions-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_permissions',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            console.log('useUserPermissions - Permissions changed:', payload);
            // Reset the fetched ref to force refetch
            fetchedRef.current = null;
            // Refetch permissions
            fetchPermissions();
            
            // Redirect to first available page after permission change
            setTimeout(() => {
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

              // Find first available page based on new permissions
              for (const { path, permission } of redirectPriority) {
                if (permissions.includes(permission)) {
                  navigate(path, { replace: true });
                  return;
                }
              }

              // If no permissions, logout
              navigate('/auth', { replace: true });
            }, 500);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userId, role, navigate, permissions]);

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
