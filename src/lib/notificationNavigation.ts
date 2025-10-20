import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * Initialize notification navigation handler for deep linking
 * Handles navigation when app is opened from a notification tap
 */
export const initializeNotificationNavigation = (navigate: (path: string) => void) => {
  const platform = Capacitor.getPlatform();
  
  if (platform === 'web') {
    return;
  }

  console.log('🔀 [NAV] Initializing notification navigation handler');

  // Listen for app state changes (resume from background)
  App.addListener('appStateChange', async ({ isActive }) => {
    if (isActive) {
      console.log('📱 [NAV] App resumed - checking for pending route');
      await checkAndNavigateToPendingRoute(navigate);
    }
  });

  // Listen for app URL open (when app is opened via intent)
  App.addListener('appUrlOpen', async (data) => {
    console.log('🔗 [NAV] App opened via URL/Intent:', data);
    await checkAndNavigateToPendingRoute(navigate);
  });

  // Check immediately on initialization
  checkAndNavigateToPendingRoute(navigate);
};

/**
 * Check for pending route and navigate if found
 */
export const checkAndNavigateToPendingRoute = async (navigate: (path: string) => void) => {
  try {
    const { value: pendingRoute } = await Preferences.get({ key: 'pendingRoute' });
    
    if (pendingRoute) {
      console.log('🔀 [NAV] Found pending route:', pendingRoute);
      
      // Clear the pending route
      await Preferences.remove({ key: 'pendingRoute' });
      
      // Navigate to the route
      console.log('✅ [NAV] Navigating to:', pendingRoute);
      navigate(pendingRoute);
    } else {
      console.log('ℹ️ [NAV] No pending route found');
    }
  } catch (error) {
    console.error('❌ [NAV] Error checking pending route:', error);
  }
};
