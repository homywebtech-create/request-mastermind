import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { APP_VERSION } from '@/lib/appVersion';

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
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<AppVersion | null>(null);
  const [checking, setChecking] = useState(false);

  const checkForUpdates = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-app-update', {
        body: { currentVersionCode: APP_VERSION.code }
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

  // Periodic update checks (every 6 hours)
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('⏰ Periodic update check triggered');
      checkForUpdates();
    }, 6 * 60 * 60 * 1000); // 6 hours

    return () => clearInterval(interval);
  }, []);

  return {
    updateAvailable,
    latestVersion,
    checking,
    checkForUpdates
  };
};