import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * Initialize notification navigation handler for deep linking
 * Captures deep-link URLs from notification taps and stores the target route.
 * Navigation is handled centrally in App.tsx to avoid race conditions.
 */
export const initializeNotificationNavigation = (navigate: (path: string) => void) => {
  const platform = Capacitor.getPlatform();
  
  if (platform === 'web') {
    return;
  }

  console.log('🔀 [NAV] Initializing notification navigation handler');

  // Helper: parse deep link URL into an app route
  const extractRouteFromUrl = (url?: string | null): string | null => {
    try {
      if (!url) return null;
      const parsed = new URL(url);
      const routeParam = parsed.searchParams.get('route') || parsed.searchParams.get('path');
      if (routeParam) return decodeURIComponent(routeParam);
      const pathname = parsed.pathname; // e.g. /order-tracking/123
      if (pathname && pathname !== '/') return pathname;
      return null;
    } catch {
      return null;
    }
  };

  // Listen for app state changes (resume from background)
  App.addListener('appStateChange', async ({ isActive }) => {
    if (isActive) {
      console.log('📱 [NAV] App resumed - pending route (if any) will be handled by App root');
    }
  });

  // Listen for app URL open (when app is opened via intent)
  App.addListener('appUrlOpen', async (data) => {
    console.log('🔗 [NAV] App opened via URL/Intent:', data);
    const route = extractRouteFromUrl((data as any)?.url);
    if (route) {
      console.log('🧭 [NAV] Deep link contained route:', route);
      await Preferences.set({ key: 'pendingRoute', value: route });
    }
    // Do NOT navigate here; App.tsx handles it once auth is ready
  });

  // Check initial launch URL as well (cold start via notification)
  void (async () => {
    try {
      const launch = await App.getLaunchUrl();
      const route = extractRouteFromUrl((launch as any)?.url);
      if (route) {
        console.log('🧭 [NAV] Launch URL contained route:', route);
        await Preferences.set({ key: 'pendingRoute', value: route });
      }
    } catch (e) {
      console.warn('⚠️ [NAV] Could not read launch URL', e);
    }
  })();

  // Check immediately on initialization
  checkAndNavigateToPendingRoute(navigate);
};

/**
 * Check for pending route and navigate if found.
 * Note: We keep this utility exported for manual invocations if ever needed,
 * but initializeNotificationNavigation no longer calls it automatically.
 */
export const checkAndNavigateToPendingRoute = async (navigate: (path: string) => void) => {
  try {
    const { value: pendingRoute } = await Preferences.get({ key: 'pendingRoute' });
    
    if (pendingRoute) {
      console.log('🔀 [NAV] Found pending route:', pendingRoute);
      await Preferences.remove({ key: 'pendingRoute' });
      console.log('✅ [NAV] Navigating to:', pendingRoute);
      navigate(pendingRoute);
    } else {
      console.log('ℹ️ [NAV] No pending route found');
    }
  } catch (error) {
    console.error('❌ [NAV] Error checking pending route:', error);
  }
};
