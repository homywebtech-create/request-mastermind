import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { requestFullScreenPermission, checkFullScreenPermission } from './notificationPermissions';

export class FirebaseNotificationManager {
  private static instance: FirebaseNotificationManager;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): FirebaseNotificationManager {
    if (!FirebaseNotificationManager.instance) {
      FirebaseNotificationManager.instance = new FirebaseNotificationManager();
    }
    return FirebaseNotificationManager.instance;
  }

  /**
   * Initialize Firebase Push Notifications
   * Must be called after user authentication
   */
  async initialize(specialistId: string): Promise<void> {
    if (this.isInitialized) {
      console.log('🔔 [FCM] Already initialized');
      return;
    }

    try {
      const platform = Capacitor.getPlatform();
      
      if (platform === 'web') {
        console.log('ℹ️ [FCM] Web platform - skipping native push notifications');
        return;
      }

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 [FCM] بدء تهيئة Firebase Cloud Messaging');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // Step 1: Request permissions
      console.log('🔐 [STEP 1] طلب أذونات الإشعارات...');
      const permResult = await PushNotifications.requestPermissions();
      
      if (permResult.receive === 'granted') {
        console.log('✅ تم منح الأذونات');
        
        // Step 1.5: Request full-screen intent permission (Android 12+)
        if (platform === 'android') {
          const hasFullScreenPermission = await checkFullScreenPermission();
          if (!hasFullScreenPermission) {
            console.log('⚠️ Full-screen intent permission not granted, requesting...');
            await requestFullScreenPermission();
            console.log('ℹ️ Please enable "Display over other apps" in system settings for notifications to appear on lock screen');
          }
        }
        
        // Step 2: Register with FCM
        console.log('📝 [STEP 2] التسجيل في FCM...');
        await PushNotifications.register();
        
        // Step 3: Listen for token registration
        await PushNotifications.addListener('registration', async (token) => {
          console.log('🎟️ [TOKEN] تم الحصول على Token:', token.value.substring(0, 20) + '...');
          
          // Save token to database
          await this.saveDeviceToken(specialistId, token.value, platform);
        });

        // Step 4: Listen for notification received (foreground)
        await PushNotifications.addListener('pushNotificationReceived', async (notification) => {
          console.log('📬 [FOREGROUND] إشعار في المقدمة:', notification);
          
          const nType = (notification?.data?.type || '').toLowerCase();
          
          // Handle readiness check notification
          if (nType === 'readiness_check') {
            console.log('⏰ [READINESS CHECK] Received readiness check notification');
            
            // Dispatch event to show readiness dialog
            window.dispatchEvent(new CustomEvent('readiness-check-received', {
              detail: {
                orderId: notification.data?.orderId,
                title: notification.title,
                body: notification.body
              }
            }));
            
            // Import haptics and sound
            const { Haptics } = await import('@capacitor/haptics');
            
            // Strong vibration pattern for urgency
            try {
              for (let i = 0; i < 3; i++) {
                await Haptics.vibrate({ duration: 500 });
                await new Promise(resolve => setTimeout(resolve, 300));
              }
            } catch (e) {
              console.log('Haptics not available');
            }
            
            console.log('✅ Readiness check event dispatched');
            return;
          }
          
          // Avoid duplicate UI for app update notifications
          if (nType === 'app_update') {
            console.log('🔕 [FCM] Skipping local notification for app_update to avoid duplicates');
            return;
          }
          
          // Import dynamically to avoid circular dependencies
          const { LocalNotifications } = await import('@capacitor/local-notifications');
          const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
          
          // Show local notification with high priority and sound
          await LocalNotifications.schedule({
            notifications: [
              {
                title: notification.title || 'طلب جديد',
                body: notification.body || 'لديك طلب جديد',
                id: Date.now(),
                schedule: { at: new Date(Date.now() + 100) },
                sound: 'notification_sound.mp3',
                attachments: undefined,
                actionTypeId: '',
                extra: notification.data,
                smallIcon: 'ic_stat_icon_config_sample',
                channelId: 'new-orders-v3',
              }
            ]
          });
          
          // Strong vibration pattern
          try {
            await Haptics.vibrate({ duration: 1000 });
            setTimeout(() => Haptics.vibrate({ duration: 500 }), 1200);
            setTimeout(() => Haptics.vibrate({ duration: 1000 }), 2000);
          } catch (e) {
            console.log('Haptics not available');
          }
          
          console.log('✅ عرض إشعار محلي مع صوت واهتزاز');
        });

        // Step 5: Listen for notification action (tap)
        await PushNotifications.addListener('pushNotificationActionPerformed', async (notification) => {
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('👆 [NOTIFICATION TAP] User tapped notification');
          console.log('📦 Full notification data:', JSON.stringify(notification, null, 2));
          console.log('📦 notification.notification:', notification.notification);
          console.log('📦 notification.notification.data:', notification.notification.data);
          
          const nType = notification.notification.data?.type;
          console.log('🔍 [TYPE] Notification type:', nType);
          
          // Handle readiness check tap
          if (nType === 'readiness_check') {
            console.log('⏰ [READINESS TAP] Opening readiness check dialog');
            
            // Dispatch event to show readiness dialog
            window.dispatchEvent(new CustomEvent('readiness-check-received', {
              detail: {
                orderId: notification.notification.data?.orderId,
                title: notification.notification.title,
                body: notification.notification.body
              }
            }));
            
            // Navigate to home if not already there
            window.dispatchEvent(new CustomEvent('notificationNavigate', {
              detail: { route: '/specialist/home' }
            }));
            
            return;
          }
          
          // Get the route from notification data - check multiple possible locations
          let route = notification.notification.data?.route;
          console.log('🔍 [ROUTE CHECK] notification.notification.data.route:', route);
          
          // Fallback to different data structures if route not found
          if (!route) {
            route = (notification as any).data?.route;
            console.log('🔍 [ROUTE CHECK] notification.data.route:', route);
          }
          
          // Final fallback based on notification type
          if (!route) {
            if (nType === 'new_order' || nType === 'resend_order' || nType === 'test') {
              route = '/specialist/offers';
            } else if (nType === 'new_quote' || nType === 'quote_response' || nType === 'booking_confirmed') {
              route = '/specialist-orders';
            } else {
              route = '/specialist-orders/new';
            }
            console.log('⚠️ [ROUTE] No route in data, using fallback based on type:', route);
          }
          
          console.log('🔀 [NAVIGATION] Final target route:', route);
          
          const { Preferences } = await import('@capacitor/preferences');
          await Preferences.set({
            key: 'pendingRoute',
            value: route,
          });
          
          console.log('✅ [SAVED] Route saved to preferences:', route);
          
          // CRITICAL: Emit event for immediate navigation when app is running
          console.log('📤 [DISPATCH] Dispatching navigation events...');
          
          window.dispatchEvent(new CustomEvent('notificationNavigate', { 
            detail: { route: route } 
          }));
          console.log('✅ [DISPATCH] notificationNavigate event dispatched');
          
          window.dispatchEvent(new CustomEvent('specialist-navigate', { 
            detail: { route: route } 
          }));
          console.log('✅ [DISPATCH] specialist-navigate event dispatched');
          
          window.dispatchEvent(new Event('specialist-orders-refresh'));
          console.log('✅ [DISPATCH] specialist-orders-refresh event dispatched');
          
          console.log('📤 [COMPLETE] All navigation events dispatched for route:', route);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        });

        // Step 6: Listen for registration errors
        await PushNotifications.addListener('registrationError', (error) => {
          console.error('❌ [FCM] خطأ في التسجيل:', error);
        });

        this.isInitialized = true;
        console.log('✅ [FCM] تم التهيئة بنجاح!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      } else {
        console.error('❌ [FCM] لم يتم منح الأذونات!');
        throw new Error('Push notification permissions denied');
      }
    } catch (error) {
      console.error('❌ [FCM] Fatal error during initialization:', error);
      throw error;
    }
  }

  /**
   * Save or update device token in database
   */
  private async saveDeviceToken(
    specialistId: string, 
    token: string, 
    platform: string
  ): Promise<void> {
    try {
      console.log('💾 [DB] حفظ Device Token...');
      
      // Get device info
      let deviceInfo = {
        device_model: 'unknown',
        device_os: platform,
        device_os_version: 'unknown',
        app_version: '1.0.0',
      };

      try {
        const info = await Device.getInfo();
        deviceInfo = {
          device_model: info.model,
          device_os: info.platform,
          device_os_version: info.osVersion,
          app_version: '1.0.0', // Can be updated from package.json if needed
        };
        console.log('📱 [DEVICE INFO]', deviceInfo);
      } catch (e) {
        console.warn('⚠️ Could not get device info:', e);
      }
      
      // First, delete any duplicate tokens for this specialist
      const { error: deleteError } = await supabase
        .from('device_tokens')
        .delete()
        .eq('specialist_id', specialistId)
        .neq('token', token);

      if (deleteError) {
        console.warn('⚠️ [DB] Could not delete old tokens:', deleteError);
      } else {
        console.log('🧹 [DB] Cleaned up old tokens for specialist');
      }
      
      // Upsert token (insert or update if exists)
      const { error } = await supabase
        .from('device_tokens')
        .upsert({
          specialist_id: specialistId,
          token,
          platform,
          ...deviceInfo,
          last_used_at: new Date().toISOString(),
        }, {
          onConflict: 'token',
        });

      if (error) {
        console.error('❌ [DB] خطأ في حفظ Token:', error);
        throw error;
      }

      console.log('✅ [DB] تم حفظ Token بنجاح');
    } catch (error) {
      console.error('❌ [DB] Fatal error saving token:', error);
      throw error;
    }
  }

  /**
   * Remove device token from database (on logout)
   */
  async removeDeviceToken(): Promise<void> {
    try {
      const platform = Capacitor.getPlatform();
      if (platform === 'web') return;

      // Get current token
      const tokenResult = await PushNotifications.getDeliveredNotifications();
      
      // Remove from database
      // Note: We'll need to store the token in memory or get it another way
      console.log('🗑️ [FCM] Removing device token on logout');
      
    } catch (error) {
      console.error('❌ [FCM] Error removing token:', error);
    }
  }

  /**
   * Clean up listeners
   */
  async cleanup(): Promise<void> {
    try {
      await PushNotifications.removeAllListeners();
      this.isInitialized = false;
      console.log('🧹 [FCM] Cleanup complete');
    } catch (error) {
      console.error('❌ [FCM] Cleanup error:', error);
    }
  }
}

export const firebaseNotifications = FirebaseNotificationManager.getInstance();
