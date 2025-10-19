import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { requestFullScreenPermission } from "@/lib/notificationPermissions";
import { requestBatteryOptimizationExemption, isXiaomiDevice, openAutostartSettings } from "@/lib/batteryOptimization";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  specialistId?: string;
}

export function NotificationFix({ specialistId }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const fixNow = async () => {
    try {
      setBusy(true);

      // Android 13+ notification runtime permission
      if (Capacitor.getPlatform() === "android") {
        const perm = await PushNotifications.requestPermissions();
        toast({ title: "Notifications", description: `Permission: ${perm.receive}` });
      }

      // Request full-screen + overlay (Android 12+)
      await requestFullScreenPermission();

      // Battery optimization exemption
      await requestBatteryOptimizationExemption();

      // Xiaomi/Redmi autostart settings
      const xiaomi = await isXiaomiDevice();
      if (xiaomi) {
        await openAutostartSettings();
        toast({ title: "Xiaomi settings", description: "Opened Autostart/No restrictions" });
      }

      // Register with FCM (refresh token if needed)
      try {
        await PushNotifications.register();
      } catch {}

      toast({ title: "All set", description: "Background delivery optimized" });
    } catch (e: any) {
      toast({ title: "Setup failed", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    if (!specialistId) {
      toast({ title: "Missing ID", description: "Sign in as specialist first" });
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-push-notification", {
        body: {
          specialistIds: [specialistId],
          title: "🔔 Test notification",
          body: "This is a test push. If you see it, notifications work.",
          data: { type: "test", route: "/specialist/new-orders" }
        }
      });
      if (error) throw error;
      toast({ title: "Test sent", description: `Sent: ${data?.sent ?? 0}, failed: ${data?.failed ?? 0}` });
    } catch (e: any) {
      toast({ title: "Send failed", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Button onClick={fixNow} disabled={busy} className="h-12 font-bold">
        {busy ? "Working…" : "Fix notifications"}
      </Button>
      <Button onClick={sendTest} disabled={busy} variant="outline" className="h-12 font-bold">
        Send test push
      </Button>
    </div>
  );
}

export default NotificationFix;
