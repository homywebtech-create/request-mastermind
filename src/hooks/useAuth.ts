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
          console.log('📱 [Auth] Found stored session in Preferences');
          try {
            const stored = JSON.parse(value);
            
            if (stored.access_token && stored.refresh_token) {
              console.log('🔑 [Auth] Restoring session from Preferences...');
              
              const { data, error } = await supabase.auth.setSession({
                access_token: stored.access_token,
                refresh_token: stored.refresh_token
              });

              if (!error && data.session && mounted) {
                console.log('✅ [Auth] Session restored from Preferences!');
                setSession(data.session);
                setUser(data.session.user);
                setLoading(false);
                return;
              } else {
                console.warn('⚠️ [Auth] Stored session invalid:', error?.message);
                await Preferences.remove({ key: SESSION_KEY });
              }
            }
          } catch (err) {
            console.error('❌ [Auth] Failed to parse stored session:', err);
            await Preferences.remove({ key: SESSION_KEY });
          }
        }

        // 2. Check Supabase session (fallback)
        console.log('🔍 [Auth] Checking Supabase session...');
        const { data: { session: supabaseSession } } = await supabase.auth.getSession();
        
        if (supabaseSession && mounted) {
          console.log('✅ [Auth] Supabase session found, saving to Preferences');
          setSession(supabaseSession);
          setUser(supabaseSession.user);
          
          // Save to Preferences for persistence
          await Preferences.set({
            key: SESSION_KEY,
            value: JSON.stringify(supabaseSession)
          });
        } else {
          console.log('ℹ️ [Auth] No session found');
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

    // 3. Listen to ALL auth changes and persist session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        console.log(`🔔 [Auth] Event: ${event}`, session ? 'with session' : 'no session');
        
        // Handle ALL events to ensure persistence
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          if (session) {
            console.log(`💾 [Auth] Saving session for ${event}`);
            setSession(session);
            setUser(session.user);
            
            // Always save to Preferences
            await Preferences.set({
              key: SESSION_KEY,
              value: JSON.stringify(session)
            });
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('👋 [Auth] Explicit sign out - clearing session');
          setSession(null);
          setUser(null);
          await Preferences.remove({ key: SESSION_KEY });
        }
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
