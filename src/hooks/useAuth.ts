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

  // 1) Subscribe FIRST to capture INITIAL_SESSION and future events (no async in callback)
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
    const restored = await restoreFromPreferences();
    if (!restored) {
      const { data: { session } } = await supabase.auth.getSession();
      state = { user: session?.user ?? null, session: session ?? null, loading: false };
      notify();
      if (session) {
        Preferences.set({ key: SESSION_KEY, value: JSON.stringify(session) }).catch(() => {});
      }
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

