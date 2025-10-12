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

    // Initialize session from storage FIRST
    const initSession = async () => {
      try {
        console.log('🔄 Initializing session...');
        
        // Try to restore from Capacitor Preferences first
        const { value } = await Preferences.get({ key: SESSION_KEY });
        if (value && mounted) {
          console.log('📱 Found stored session, restoring...');
          const storedSession = JSON.parse(value);
          
          // Restore session to Supabase
          const { data, error } = await supabase.auth.setSession({
            access_token: storedSession.access_token,
            refresh_token: storedSession.refresh_token
          });

          if (!error && data.session && mounted) {
            console.log('✅ Session restored successfully');
            setSession(data.session);
            setUser(data.session.user);
            setLoading(false);
            return;
          } else {
            console.log('❌ Stored session invalid, removing...');
            await Preferences.remove({ key: SESSION_KEY });
          }
        }

        // If no stored session, check Supabase
        const { data: { session: supabaseSession } } = await supabase.auth.getSession();
        if (supabaseSession && mounted) {
          console.log('✅ Found Supabase session');
          setSession(supabaseSession);
          setUser(supabaseSession.user);
          // Save to preferences
          await Preferences.set({
            key: SESSION_KEY,
            value: JSON.stringify(supabaseSession)
          });
        }
      } catch (error) {
        console.error('❌ Error initializing session:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Initialize session first
    initSession();

    // Then set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        console.log('🔔 Auth event:', event, session ? 'has session' : 'no session');
        
        // Only update state if this is a real auth event
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setSession(session);
          setUser(session?.user ?? null);
          
          // Persist session
          if (session) {
            await Preferences.set({
              key: SESSION_KEY,
              value: JSON.stringify(session)
            });
          }
        } else if (event === 'SIGNED_OUT') {
          // Only clear on explicit sign out
          console.log('👋 Explicit sign out');
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
