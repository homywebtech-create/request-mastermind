import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = 'admin' | 'admin_full' | 'admin_manager' | 'admin_viewer' | 'specialist' | null;

export function useUserRole(userId: string | undefined) {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setRole(null);
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (!error && data) {
        const roles = data.map((r: any) => r.role as UserRole);
        // Role priority (highest first)
        const priority: UserRole[] = ['admin', 'admin_full', 'admin_manager', 'admin_viewer', 'specialist', null];
        const found = priority.find((r) => (r ? roles.includes(r) : roles.length === 0)) ?? null;
        setRole(found ?? null);
      } else {
        setRole(null);
      }
      setLoading(false);
    };

    fetchRole();
  }, [userId]);

  const isAdmin = role === 'admin' || role === 'admin_full' || role === 'admin_manager' || role === 'admin_viewer';
  return { role, loading, isAdmin, isSpecialist: role === 'specialist' };
}
