import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = 'admin' | 'admin_full' | 'admin_manager' | 'admin_viewer' | 'specialist' | null;

export function useUserRole(userId: string | undefined) {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const previousUserIdRef = useRef<string | undefined>(undefined);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    // Skip if userId hasn't actually changed (value comparison, not reference)
    if (previousUserIdRef.current === userId) {
      return;
    }

    if (!userId) {
      console.log('useUserRole - No userId provided');
      previousUserIdRef.current = undefined;
      setRole(null);
      setLoading(false);
      return;
    }

    // Only reset and fetch if userId actually changed and not already fetching
    if (previousUserIdRef.current !== userId && !isFetchingRef.current) {
      console.log('useUserRole - userId changed from', previousUserIdRef.current, 'to', userId);
      previousUserIdRef.current = userId;
      setLoading(true);
      isFetchingRef.current = true;
      
      let cancelled = false;
      
      const fetchRole = async () => {
        console.log('useUserRole - Fetching role for userId:', userId);
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId);

        console.log('useUserRole - Query result:', { data, error });

        if (cancelled) {
          console.log('useUserRole - Fetch cancelled');
          isFetchingRef.current = false;
          return;
        }

        if (!error && data && data.length > 0) {
          const roles = data.map((r: any) => r.role as UserRole);
          console.log('useUserRole - Mapped roles:', roles);
          // Role priority (highest first)
          const priority: UserRole[] = ['admin', 'admin_full', 'admin_manager', 'admin_viewer', 'specialist', null];
          const found = priority.find((r) => (r ? roles.includes(r) : roles.length === 0)) ?? null;
          console.log('useUserRole - Found role:', found);
          setRole(found);
        } else {
          console.log('useUserRole - Setting role to null due to error or no data');
          setRole(null);
        }
        setLoading(false);
        isFetchingRef.current = false;
      };

      fetchRole();
      
      return () => {
        cancelled = true;
        isFetchingRef.current = false;
      };
    }
  }, [userId]);

  const isAdmin = role === 'admin' || role === 'admin_full' || role === 'admin_manager' || role === 'admin_viewer';
  return { role, loading, isAdmin, isSpecialist: role === 'specialist' };
}
