import { useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Preferences } from '@capacitor/preferences';

// Singleton Auth State to avoid duplicate subscriptions across components
const SESSION_KEY = 'supabase_session';

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
};

let state: AuthState = { user: null, session: null, loading: true };
const subscribers = new Set<(s: AuthState) => void>();
let initialized = false;
let unsub: (() => void) | null = null;

const notify = () => {
  subscribers.forEach((cb) => {
    try { cb(state); } catch { /* noop */ }
  });
};

async function restoreFromPreferences() {
  try {
    const { value } = await Preferences.get({ key: SESSION_KEY });
    if (!value) return false;

    const stored = JSON.parse(value);
    if (stored?.access_token && stored?.refresh_token) {
      // Attempt to restore a valid session
      const { data, error } = await supabase.auth.setSession({
        access_token: stored.access_token,
        refresh_token: stored.refresh_token,
      });
      if (!error && data.session) {
        return true; // onAuthStateChange will update state
      }
      await Preferences.remove({ key: SESSION_KEY });
    }
  } catch {
    // If parsing fails, clear invalid data
    await Preferences.remove({ key: SESSION_KEY });
  }
  return false;
}

function initAuthOnce() {
  if (initialized) return;
  initialized = true;

  console.log('🔐 [AUTH] Initializing authentication...');

  // Add timeout for the entire init process
  const initTimeout = setTimeout(() => {
    console.warn('⏱️ [AUTH] Initialization timeout - forcing loading to false');
    if (state.loading) {
      state = { ...state, loading: false };
      notify();
    }
  }, 8000); // 8 seconds max for entire init

  // 1) Subscribe FIRST to capture INITIAL_SESSION and future events (no async in callback)
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    console.log('🔄 [AUTH] Auth state change:', event, session?.user?.id);
    // Only synchronous state updates inside the callback
    state = { user: session?.user ?? null, session: session ?? null, loading: false };
    notify();

    // Persist session (fire-and-forget, avoid awaits here)
    if (session) {
      Preferences.set({ key: SESSION_KEY, value: JSON.stringify(session) }).catch(() => {});
    } else {
      Preferences.remove({ key: SESSION_KEY }).catch(() => {});
    }
  });
  unsub = () => subscription.unsubscribe();

  // 2) Try to restore from persistent storage, then fall back to current session
  (async () => {
    try {
      console.log('📦 [AUTH] Attempting to restore session from preferences...');
      const restored = await Promise.race([
        restoreFromPreferences(),
        new Promise((resolve) => setTimeout(() => resolve(false), 3000)) // 3s timeout for restore
      ]);
      
      console.log('📦 [AUTH] Restore result:', restored);
      
      if (!restored) {
        console.log('📡 [AUTH] Fetching current session...');
        const { data: { session }, error } = await Promise.race([
          supabase.auth.getSession(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Session timeout')), 3000))
        ]) as any;
        
        console.log('📡 [AUTH] Session fetch result:', session?.user?.id, error);
        
        state = { user: session?.user ?? null, session: session ?? null, loading: false };
        notify();
        if (session) {
          Preferences.set({ key: SESSION_KEY, value: JSON.stringify(session) }).catch(() => {});
        }
      }
    } catch (error) {
      console.error('❌ [AUTH] Error during initialization:', error);
      state = { user: null, session: null, loading: false };
      notify();
    } finally {
      clearTimeout(initTimeout);
      console.log('✅ [AUTH] Initialization complete');
    }
  })();
}

export function useAuth() {
  const [local, setLocal] = useState<AuthState>(state);

  useEffect(() => {
    let active = true;
    initAuthOnce();

    const cb = (s: AuthState) => { if (active) setLocal(s); };
    subscribers.add(cb);
    // Emit current state immediately for new subscriber
    cb(state);

    return () => {
      active = false;
      subscribers.delete(cb);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    await Preferences.remove({ key: SESSION_KEY });
  };

  return { user: local.user, session: local.session, loading: local.loading, signOut };
}

