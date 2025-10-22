import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type UserRole = 'admin' | 'admin_full' | 'admin_manager' | 'admin_viewer' | 'specialist' | null;

interface UserRoleContextType {
  role: UserRole;
  loading: boolean;
  isAdmin: boolean;
  isSpecialist: boolean;
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

export function UserRoleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const fetchedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const userId = user?.id;

    // Skip if we already fetched for this user
    if (fetchedUserIdRef.current === userId) {
      return;
    }

    if (!userId) {
      fetchedUserIdRef.current = null;
      setRole(null);
      setLoading(false);
      return;
    }

    // Only fetch once per user
    fetchedUserIdRef.current = userId;
    setLoading(true);

    const fetchRole = async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (!error && data && data.length > 0) {
        const roles = data.map((r: any) => r.role as UserRole);
        const priority: UserRole[] = ['admin', 'admin_full', 'admin_manager', 'admin_viewer', 'specialist', null];
        const found = priority.find((r) => (r ? roles.includes(r) : roles.length === 0)) ?? null;
        setRole(found);
      } else {
        setRole(null);
      }
      setLoading(false);
    };

    fetchRole();
  }, [user?.id]);

  const isAdmin = role === 'admin' || role === 'admin_full' || role === 'admin_manager' || role === 'admin_viewer';

  return (
    <UserRoleContext.Provider value={{ role, loading, isAdmin, isSpecialist: role === 'specialist' }}>
      {children}
    </UserRoleContext.Provider>
  );
}

export function useUserRole() {
  const context = useContext(UserRoleContext);
  if (context === undefined) {
    throw new Error('useUserRole must be used within UserRoleProvider');
  }
  return context;
}
