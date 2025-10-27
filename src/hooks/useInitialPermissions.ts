import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { Preferences } from "@capacitor/preferences";
import { requestFullScreenPermission } from "@/lib/notificationPermissions";
import { requestBatteryOptimizationExemption, isXiaomiDevice, openAutostartSettings } from "@/lib/batteryOptimization";

const PERMISSIONS_REQUESTED_KEY = "notification_permissions_requested";

export function useInitialPermissions() {
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") {
      return;
    }

    const requestAllPermissions = async () => {
      try {
        // Check if we've already requested permissions
        const { value } = await Preferences.get({ key: PERMISSIONS_REQUESTED_KEY });
        if (value === "true") {
          console.log("✅ Permissions already requested previously");
          return;
        }

        console.log("🔐 First launch - requesting all permissions...");
        setIsRequesting(true);

        // 1. Android 13+ notification runtime permission
        console.log("📱 Requesting notification permission...");
        const perm = await PushNotifications.requestPermissions();
        console.log("📱 Notification permission:", perm.receive);

        // 2. Full-screen intent permission (Android 12+)
        console.log("🔐 Requesting full-screen permission...");
        await requestFullScreenPermission();

        // 3. Battery optimization exemption
        console.log("🔋 Requesting battery optimization exemption...");
        await requestBatteryOptimizationExemption();

        // 4. Xiaomi/Redmi autostart settings
        const xiaomi = await isXiaomiDevice();
        if (xiaomi) {
          console.log("📱 Xiaomi device detected - opening autostart settings...");
          await openAutostartSettings();
        }

        // 5. Register with FCM
        console.log("📲 Registering with FCM...");
        await PushNotifications.register();

        // Mark permissions as requested
        await Preferences.set({ key: PERMISSIONS_REQUESTED_KEY, value: "true" });
        console.log("✅ All permissions requested successfully");
      } catch (error) {
        console.error("❌ Error requesting permissions:", error);
      } finally {
        setIsRequesting(false);
      }
    };

    // Small delay to let app finish initializing
    const timer = setTimeout(() => {
      requestAllPermissions();
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return { isRequesting };
}
