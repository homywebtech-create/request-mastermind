import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';

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
                sound: 'short_notification.mp3',
                attachments: undefined,
                actionTypeId: '',
                extra: notification.data,
                smallIcon: 'ic_stat_icon_config_sample',
                channelId: 'new-orders',
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
          console.log('👆 [TAP] تم النقر على الإشعار:', notification);
          
          // Store pending navigation in preferences
          const route = notification.notification.data?.route || '/specialist/new-orders';
          console.log('🔀 حفظ وجهة التنقل:', route);
          
          const { Preferences } = await import('@capacitor/preferences');
          await Preferences.set({
            key: 'pendingNavigation',
            value: route,
          });
          
          console.log('✅ تم حفظ وجهة التنقل - سيتم التوجيه بعد استعادة الجلسة');
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
      
      // Upsert token (insert or update if exists)
      const { error } = await supabase
        .from('device_tokens')
        .upsert({
          specialist_id: specialistId,
          token,
          platform,
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
