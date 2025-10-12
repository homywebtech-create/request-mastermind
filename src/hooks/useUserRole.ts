import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = 'admin' | 'admin_full' | 'admin_manager' | 'admin_viewer' | 'specialist' | null;

export function useUserRole(userId: string | undefined) {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      console.log('useUserRole - No userId provided');
      setRole(null);
      setLoading(false);
      return;
    }

    // CRITICAL: Set loading to true when starting to fetch
    setLoading(true);
    
    const fetchRole = async () => {
      console.log('useUserRole - Fetching role for userId:', userId);
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      console.log('useUserRole - Query result:', { data, error });

      if (!error && data) {
        const roles = data.map((r: any) => r.role as UserRole);
        console.log('useUserRole - Mapped roles:', roles);
        // Role priority (highest first)
        const priority: UserRole[] = ['admin', 'admin_full', 'admin_manager', 'admin_viewer', 'specialist', null];
        const found = priority.find((r) => (r ? roles.includes(r) : roles.length === 0)) ?? null;
        console.log('useUserRole - Found role:', found);
        setRole(found ?? null);
      } else {
        console.log('useUserRole - Setting role to null due to error or no data');
        setRole(null);
      }
      setLoading(false);
    };

    fetchRole();
  }, [userId]);

  const isAdmin = role === 'admin' || role === 'admin_full' || role === 'admin_manager' || role === 'admin_viewer';
  return { role, loading, isAdmin, isSpecialist: role === 'specialist' };
}
