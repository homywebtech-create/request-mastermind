import { useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Preferences } from '@capacitor/preferences';

const SESSION_KEY = 'supabase_session';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      try {
        console.log('🔄 [Auth] Starting init...');
        
        // 1. Check Capacitor Preferences FIRST (persistent storage)
        const { value } = await Preferences.get({ key: SESSION_KEY });
        
        if (value) {
          console.log('📱 [Auth] Found stored session');
          try {
            const stored = JSON.parse(value);
            
            if (stored.access_token && stored.refresh_token) {
              console.log('🔑 [Auth] Restoring session...');
              
              const { data, error } = await supabase.auth.setSession({
                access_token: stored.access_token,
                refresh_token: stored.refresh_token
              });

              if (!error && data.session && mounted) {
                console.log('✅ [Auth] Session restored!');
                setSession(data.session);
                setUser(data.session.user);
                setLoading(false);
                return;
              } else {
                console.warn('⚠️ [Auth] Invalid session:', error?.message);
                await Preferences.remove({ key: SESSION_KEY });
              }
            }
          } catch (err) {
            console.error('❌ [Auth] Parse error:', err);
            await Preferences.remove({ key: SESSION_KEY });
          }
        }

        // 2. Check Supabase session
        const { data: { session: supabaseSession } } = await supabase.auth.getSession();
        
        if (supabaseSession && mounted) {
          console.log('✅ [Auth] Supabase session active');
          setSession(supabaseSession);
          setUser(supabaseSession.user);
          
          await Preferences.set({
            key: SESSION_KEY,
            value: JSON.stringify(supabaseSession)
          });
        } else {
          console.log('ℹ️ [Auth] No session');
        }
      } catch (error) {
        console.error('❌ [Auth] Init error:', error);
      } finally {
        if (mounted) {
          setLoading(false);
          console.log('✅ [Auth] Init complete');
        }
      }
    };

    initSession();

    // 3. Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        console.log(`🔔 [Auth] ${event}`);
        
        // Only persist on explicit actions
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session) {
            await Preferences.set({
              key: SESSION_KEY,
              value: JSON.stringify(session)
            });
          }
        } else if (event === 'SIGNED_OUT') {
          // Only clear on explicit logout
          console.log('👋 [Auth] Signed out');
          setSession(null);
          setUser(null);
          await Preferences.remove({ key: SESSION_KEY });
        }
        // Ignore INITIAL_SESSION to prevent unwanted clears
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    await Preferences.remove({ key: SESSION_KEY });
  };

  return { user, session, loading, signOut };
}
