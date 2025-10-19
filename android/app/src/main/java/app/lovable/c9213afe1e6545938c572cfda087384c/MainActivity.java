package app.lovable.c9213afe1e6545938c572cfda087384c;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.media.AudioAttributes;
import android.provider.Settings;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(NotificationPermissionPlugin.class);
        registerPlugin(BatteryOptimizationPlugin.class);
        createNotificationChannel();
        checkAndRequestPermissions();
    }
    
    private void checkAndRequestPermissions() {
        // 1. Battery optimization exemption (CRITICAL for Xiaomi/Redmi devices)
        BatteryOptimizationHelper.requestBatteryOptimizationExemption(this);
        
        // 2. For Xiaomi devices, request autostart permission after a delay
        if (BatteryOptimizationHelper.isXiaomiDevice()) {
            new android.os.Handler().postDelayed(() -> {
                BatteryOptimizationHelper.openAutostartSettings(this);
            }, 2000);
        }
        
        // 3. For Android 12+ (API 31+), check if app can use full screen intents
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null && !notificationManager.canUseFullScreenIntent()) {
                // Open settings to allow full screen intent
                Intent intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
                intent.setData(Uri.parse("package:" + getPackageName()));
                startActivity(intent);
            }
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                "new-orders-v2",
                "New Orders",
                NotificationManager.IMPORTANCE_MAX  // ✅ CHANGED: Maximum priority
            );
            channel.setDescription("Notifications for new orders");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 300, 100, 300});
            channel.setShowBadge(true);  // ✅ ADDED
            channel.setBypassDnd(true);  // ✅ ADDED
            
            // Set custom sound
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();
            
            Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/raw/short_notification");
            channel.setSound(soundUri, audioAttributes);
            
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(channel);
        }
    }
    
    @CapacitorPlugin(name = "NotificationPermission")
    public static class NotificationPermissionPlugin extends Plugin {
        @PluginMethod
        public void requestFullScreenPermission(PluginCall call) {
            // 1) Full-screen intent setting (Android 12+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                NotificationManager notificationManager = getContext().getSystemService(NotificationManager.class);
                if (notificationManager != null && !notificationManager.canUseFullScreenIntent()) {
                    Intent fsIntent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
                    fsIntent.setData(Uri.parse("package:" + getContext().getPackageName()));
                    getActivity().startActivity(fsIntent);
                }
            }

            // 2) Overlay (Display over other apps)
            boolean needsOverlay = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) && !Settings.canDrawOverlays(getContext());
            if (needsOverlay) {
                Intent overlayIntent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getContext().getPackageName()));
                getActivity().startActivity(overlayIntent);
            }

            // 3) Xiaomi/MIUI specific settings to ensure background delivery
            try {
                String manufacturer = android.os.Build.MANUFACTURER;
                if (manufacturer != null && manufacturer.equalsIgnoreCase("Xiaomi")) {
                    // Autostart manager
                    try {
                        Intent intent = new Intent();
                        intent.setComponent(new android.content.ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"));
                        getActivity().startActivity(intent);
                    } catch (Exception ignored) {}

                    // Battery optimization list (No restrictions)
                    try {
                        Intent intent = new Intent("miui.intent.action.POWER_HIDE_MODE_APP_LIST");
                        intent.addCategory(Intent.CATEGORY_DEFAULT);
                        getActivity().startActivity(intent);
                    } catch (Exception ignored) {}
                }
            } catch (Exception ignored) {}

            call.resolve();
        }
        
        @PluginMethod
        public void checkFullScreenPermission(PluginCall call) {
            boolean fullScreenAllowed = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                NotificationManager notificationManager = getContext().getSystemService(NotificationManager.class);
                fullScreenAllowed = notificationManager != null && notificationManager.canUseFullScreenIntent();
            }
            boolean overlayAllowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(getContext());

            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("hasPermission", fullScreenAllowed && overlayAllowed);
            ret.put("fullScreenAllowed", fullScreenAllowed);
            ret.put("overlayAllowed", overlayAllowed);
            call.resolve(ret);
        }
    }
}
