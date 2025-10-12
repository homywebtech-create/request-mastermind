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
    let sessionInitialized = false;

    const initSession = async () => {
      try {
        console.log('🔄 [Auth Init] Starting session initialization...');
        
        // STEP 1: Try to restore from Capacitor Preferences (persistent storage)
        const { value } = await Preferences.get({ key: SESSION_KEY });
        
        if (value) {
          console.log('📱 [Auth Init] Found stored session in Preferences');
          try {
            const storedSession = JSON.parse(value);
            
            // Validate that the stored session has the required fields
            if (storedSession.access_token && storedSession.refresh_token) {
              console.log('🔑 [Auth Init] Restoring session to Supabase...');
              
              // Restore session to Supabase client
              const { data, error } = await supabase.auth.setSession({
                access_token: storedSession.access_token,
                refresh_token: storedSession.refresh_token
              });

              if (!error && data.session && mounted) {
                console.log('✅ [Auth Init] Session restored successfully!');
                setSession(data.session);
                setUser(data.session.user);
                sessionInitialized = true;
                setLoading(false);
                return;
              } else {
                console.warn('⚠️ [Auth Init] Stored session invalid:', error?.message);
                await Preferences.remove({ key: SESSION_KEY });
              }
            } else {
              console.warn('⚠️ [Auth Init] Stored session missing tokens');
              await Preferences.remove({ key: SESSION_KEY });
            }
          } catch (parseError) {
            console.error('❌ [Auth Init] Error parsing stored session:', parseError);
            await Preferences.remove({ key: SESSION_KEY });
          }
        } else {
          console.log('ℹ️ [Auth Init] No stored session found in Preferences');
        }

        // STEP 2: If no stored session or restoration failed, check Supabase
        const { data: { session: supabaseSession } } = await supabase.auth.getSession();
        
        if (supabaseSession && mounted) {
          console.log('✅ [Auth Init] Found active Supabase session');
          setSession(supabaseSession);
          setUser(supabaseSession.user);
          sessionInitialized = true;
          
          // Save to Preferences for next time
          await Preferences.set({
            key: SESSION_KEY,
            value: JSON.stringify(supabaseSession)
          });
        } else {
          console.log('ℹ️ [Auth Init] No active session found');
        }
      } catch (error) {
        console.error('❌ [Auth Init] Critical error:', error);
      } finally {
        if (mounted) {
          setLoading(false);
          console.log('✅ [Auth Init] Initialization complete');
        }
      }
    };

    // Initialize session FIRST
    initSession();

    // STEP 3: Set up auth state listener for future changes ONLY
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        console.log(`🔔 [Auth Event] ${event}`, session ? '(has session)' : '(no session)');
        
        // IMPORTANT: Only react to specific events to avoid clearing session on app restart
        if (event === 'SIGNED_IN') {
          console.log('✅ [Auth Event] User signed in');
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session) {
            await Preferences.set({
              key: SESSION_KEY,
              value: JSON.stringify(session)
            });
          }
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('🔄 [Auth Event] Token refreshed');
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session) {
            await Preferences.set({
              key: SESSION_KEY,
              value: JSON.stringify(session)
            });
          }
        } else if (event === 'SIGNED_OUT') {
          // ONLY clear session on EXPLICIT sign out (user clicked logout)
          console.log('👋 [Auth Event] User signed out explicitly');
          setSession(null);
          setUser(null);
          await Preferences.remove({ key: SESSION_KEY });
        }
        // IGNORE all other events (INITIAL_SESSION, USER_UPDATED, etc.) to prevent clearing session
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
