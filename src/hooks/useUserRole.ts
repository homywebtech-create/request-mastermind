import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = 'admin' | 'specialist' | null;

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
        .eq('user_id', userId)
        .single();

      if (!error && data) {
        setRole(data.role as UserRole);
      }
      setLoading(false);
    };

    fetchRole();
  }, [userId]);

  return { role, loading, isAdmin: role === 'admin', isSpecialist: role === 'specialist' };
}
