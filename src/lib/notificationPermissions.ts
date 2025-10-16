import { registerPlugin } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';

interface NotificationPermissionPlugin {
  requestFullScreenPermission(): Promise<void>;
  checkFullScreenPermission(): Promise<{ hasPermission: boolean }>;
}

const NotificationPermission = registerPlugin<NotificationPermissionPlugin>('NotificationPermission');

/**
 * Request full-screen intent permission (Android 12+)
 * This allows notifications to show on top of the lock screen
 */
export async function requestFullScreenPermission(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') {
    console.log('⚠️ Full-screen intent permission only needed on Android');
    return;
  }

  try {
    console.log('🔐 Requesting full-screen intent permission...');
    await NotificationPermission.requestFullScreenPermission();
    console.log('✅ Full-screen intent permission requested');
  } catch (error) {
    console.error('❌ Error requesting full-screen permission:', error);
  }
}

/**
 * Check if app has full-screen intent permission
 */
export async function checkFullScreenPermission(): Promise<boolean> {
  if (Capacitor.getPlatform() !== 'android') {
    return true;
  }

  try {
    const result = await NotificationPermission.checkFullScreenPermission();
    console.log('🔍 Full-screen permission status:', result.hasPermission);
    return result.hasPermission;
  } catch (error) {
    console.error('❌ Error checking full-screen permission:', error);
    return false;
  }
}
