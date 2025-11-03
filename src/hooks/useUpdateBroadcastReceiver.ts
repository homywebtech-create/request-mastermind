import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

export const useUpdateBroadcastReceiver = (onUpdateAction: (data: any) => void) => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Register broadcast receiver for update actions
    const setupReceiver = () => {
      // Listen for update action broadcasts from Android
      (window as any).UpdateBroadcastReceiver = {
        onUpdateAction: (data: string) => {
          try {
            const updateData = JSON.parse(data);
            console.log('📱 Update action received from Android:', updateData);
            onUpdateAction(updateData);
          } catch (error) {
            console.error('Error parsing update data:', error);
          }
        },
        onCloseApp: () => {
          console.log('📱 Closing app due to mandatory update skip');
          App.exitApp();
        }
      };
    };

    setupReceiver();

    return () => {
      delete (window as any).UpdateBroadcastReceiver;
    };
  }, [onUpdateAction]);
};
