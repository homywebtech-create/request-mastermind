import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

export interface UpdateNotificationData {
  type: string;
  version_id: string;
  version_code: string;
  version_name: string;
  apk_url: string;
  is_mandatory: string;
  changelog: string;
}

export const useUpdateNotificationHandler = (
  onUpdateReceived: (data: UpdateNotificationData) => void
) => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let foregroundListener: any;
    let actionListener: any;

    const setupListeners = async () => {
      // Listen for notifications when app is in foreground
      foregroundListener = await PushNotifications.addListener(
        'pushNotificationReceived',
        (notification) => {
          console.log('📱 [Update] Push notification received in foreground:', notification);
          
          const data = notification.data as UpdateNotificationData;
          if (data?.type === 'app_update') {
            console.log('🔄 [Update] App update notification detected');
            onUpdateReceived(data);
          }
        }
      );

      // Listen for notifications when user taps on them
      actionListener = await PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (notification) => {
          console.log('📱 [Update] Push notification action performed:', notification);
          
          const data = notification.notification.data as UpdateNotificationData;
          if (data?.type === 'app_update') {
            console.log('🔄 [Update] App update notification tapped');
            onUpdateReceived(data);
          }
        }
      );
    };

    setupListeners();

    return () => {
      foregroundListener?.remove();
      actionListener?.remove();
    };
  }, [onUpdateReceived]);
};
