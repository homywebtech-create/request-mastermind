import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useUpdateNotificationHandler, UpdateNotificationData } from './useUpdateNotificationHandler';
import { useUpdateBroadcastReceiver } from './useUpdateBroadcastReceiver';

export interface AppVersion {
  id: string;
  version_code: number;
  version_name: string;
  apk_url: string;
  changelog: string | null;
  is_mandatory: boolean;
  created_at: string;
  updated_at: string;
}

export const useAppUpdate = () => {
  const isNative = typeof (Capacitor as any)?.isNativePlatform === 'function'
    ? Capacitor.isNativePlatform()
    : Capacitor.getPlatform() !== 'web';
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<AppVersion | null>(null);
  const [checking, setChecking] = useState(false);

  const checkForUpdates = async () => {
    if (!isNative) return null;
    setChecking(true);
    try {
      // Get actual installed version code from the app
      const appInfo = await App.getInfo();
      const currentVersionCode = parseInt(appInfo.build);

      console.log('Current installed version code:', currentVersionCode);

      const { data, error } = await supabase.functions.invoke('check-app-update', {
        body: { currentVersionCode }
      });

      if (error) throw error;

      if (data.needsUpdate && data.latestVersion) {
        setUpdateAvailable(true);
        setLatestVersion(data.latestVersion);
        return data.latestVersion;
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    } finally {
      setChecking(false);
    }
    return null;
  };

  // Handle push notification for updates
  const handleUpdateNotification = useCallback(async (data: UpdateNotificationData) => {
    console.log('🔔 [Update] Notification received, setting version data:', data);
    
    let currentVersionCode = 0;
    try {
      const appInfo = await App.getInfo();
      currentVersionCode = parseInt(appInfo.build);
    } catch (e) {
      console.warn('App.getInfo not available on this platform, skipping comparison');
      return;
    }
    const notificationVersionCode = parseInt(data.version_code);
    
    console.log('🔍 [Update] Version comparison:', {
      current: currentVersionCode,
      notification: notificationVersionCode,
      needsUpdate: notificationVersionCode > currentVersionCode
    });
    
    // Only show update if notification version is newer than installed
    if (notificationVersionCode <= currentVersionCode) {
      console.log('✅ [Update] Already on latest version, ignoring notification');
      return;
    }
    
    const version: AppVersion = {
      id: data.version_id,
      version_code: notificationVersionCode,
      version_name: data.version_name,
      apk_url: data.apk_url,
      is_mandatory: data.is_mandatory === 'true',
      changelog: data.changelog || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setLatestVersion(version);
    setUpdateAvailable(true);
  }, []);

  // Listen for push notifications
  useUpdateNotificationHandler(handleUpdateNotification);

  // Listen for update actions from Android activity
  useUpdateBroadcastReceiver(handleUpdateNotification);

  // Periodic update checks (every 1 minute for responsive updates)
  useEffect(() => {
    if (!isNative) return;
    
    // Check immediately on mount
    checkForUpdates();
    
    const interval = setInterval(() => {
      console.log('⏰ Periodic update check triggered');
      checkForUpdates();
    }, 1 * 60 * 1000); // 1 minute

    return () => clearInterval(interval);
  }, [isNative]);

  return {
    updateAvailable,
    latestVersion,
    checking,
    checkForUpdates
  };
};