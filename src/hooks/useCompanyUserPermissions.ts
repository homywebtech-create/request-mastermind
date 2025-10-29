import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CompanyPermission } from '@/config/companyPermissions';

interface CompanyUserPermissionsResult {
  permissions: CompanyPermission[];
  isOwner: boolean;
  loading: boolean;
  hasPermission: (permission: CompanyPermission) => boolean;
  hasAnyPermission: (requiredPermissions: CompanyPermission[]) => boolean;
  hasAllPermissions: (requiredPermissions: CompanyPermission[]) => boolean;
}

/**
 * Hook to manage company user permissions
 * Fetches permissions from company_user_permissions table
 */
export function useCompanyUserPermissions(
  userId: string | undefined
): CompanyUserPermissionsResult {
  const [permissions, setPermissions] = useState<CompanyPermission[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      try {
        // Get company user info
        const { data: companyUser, error: userError } = await supabase
          .from('company_users')
          .select('id, is_owner')
          .eq('user_id', userId)
          .eq('is_active', true)
          .maybeSingle();

        if (userError) throw userError;

        if (!companyUser) {
          setPermissions([]);
          setIsOwner(false);
          return;
        }

        setIsOwner(companyUser.is_owner);

        // If owner, they have all permissions
        if (companyUser.is_owner) {
          setPermissions([
            'manage_specialists',
            'view_specialists',
            'manage_orders',
            'view_orders',
            'manage_contracts',
            'view_contracts',
            'manage_team',
            'view_reports',
          ]);
          return;
        }

        // Get specific permissions for non-owner users
        const { data: userPermissions, error: permsError } = await supabase
          .from('company_user_permissions')
          .select('permission')
          .eq('company_user_id', companyUser.id);

        if (permsError) throw permsError;

        const permsList = userPermissions?.map(p => p.permission as CompanyPermission) || [];
        setPermissions(permsList);
      } catch (error) {
        console.error('Error fetching company user permissions:', error);
        setPermissions([]);
        setIsOwner(false);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();

    // Set up realtime subscription for permission changes
    const channel = supabase
      .channel(`company-user-permissions-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_user_permissions',
        },
        () => {
          fetchPermissions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const hasPermission = (permission: CompanyPermission): boolean => {
    if (isOwner) return true;
    return permissions.includes(permission);
  };

  const hasAnyPermission = (requiredPermissions: CompanyPermission[]): boolean => {
    if (isOwner) return true;
    return requiredPermissions.some(p => permissions.includes(p));
  };

  const hasAllPermissions = (requiredPermissions: CompanyPermission[]): boolean => {
    if (isOwner) return true;
    return requiredPermissions.every(p => permissions.includes(p));
  };

  return {
    permissions,
    isOwner,
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };
}
