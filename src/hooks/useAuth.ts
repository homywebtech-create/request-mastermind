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
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Persist session to Capacitor Preferences for mobile
        if (session) {
          await Preferences.set({
            key: SESSION_KEY,
            value: JSON.stringify(session)
          });
        } else if (event === 'SIGNED_OUT') {
          await Preferences.remove({ key: SESSION_KEY });
        }
      }
    );

    // Initialize session from storage or Supabase
    const initSession = async () => {
      try {
        // First try to get session from Supabase
        const { data: { session: supabaseSession } } = await supabase.auth.getSession();
        
        if (supabaseSession) {
          setSession(supabaseSession);
          setUser(supabaseSession.user);
          setLoading(false);
          return;
        }

        // If no Supabase session, try to restore from Capacitor Preferences
        const { value } = await Preferences.get({ key: SESSION_KEY });
        if (value) {
          const storedSession = JSON.parse(value);
          
          // Restore session to Supabase
          const { data, error } = await supabase.auth.setSession({
            access_token: storedSession.access_token,
            refresh_token: storedSession.refresh_token
          });

          if (!error && data.session) {
            setSession(data.session);
            setUser(data.session.user);
          } else {
            // Invalid session, remove it
            await Preferences.remove({ key: SESSION_KEY });
          }
        }
      } catch (error) {
        console.error('Error initializing session:', error);
      } finally {
        setLoading(false);
      }
    };

    initSession();

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    await Preferences.remove({ key: SESSION_KEY });
  };

  return { user, session, loading, signOut };
}
