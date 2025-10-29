package app.lovable.c9213afe1e6545938c572cfda087384c;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.media.AudioAttributes;
import android.provider.Settings;
import android.view.WindowManager;
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
        registerPlugin(NotificationRoutePlugin.class);
        createNotificationChannel();
        checkAndRequestPermissions();
        ensureWakeAndShowIfFromNotification(getIntent());
        handleNotificationRoute(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        ensureWakeAndShowIfFromNotification(intent);
        handleNotificationRoute(intent);
    }
    
    private void handleNotificationRoute(Intent intent) {
        if (intent == null) return;
        
        boolean fromNotification = intent.getBooleanExtra("fromNotification", false);
        String route = intent.getStringExtra("route");
        
        android.util.Log.d("MainActivity", "📍 handleNotificationRoute - fromNotification: " + fromNotification + ", route: " + route);
        
        if (fromNotification && route != null && !route.isEmpty()) {
            // Map old routes to new routes
            String targetRoute = route;
            if (route.equals("/specialist-orders/new")) {
                targetRoute = "/specialist/new-orders";
            }
            
            final String finalRoute = targetRoute;
            
            // Post delay to ensure JS is ready
            new android.os.Handler().postDelayed(() -> {
                getBridge().triggerJSEvent("notificationRoute", "window", 
                    "{\"route\":\"" + finalRoute + "\"}");
                android.util.Log.d("MainActivity", "✅ Sent notificationRoute event with route: " + finalRoute);
            }, 500);
        }
    }
    
private void ensureWakeAndShowIfFromNotification(Intent intent) {
        if (intent == null) return;
        boolean fromNotification = intent.getBooleanExtra("fromNotification", false);
        if (!fromNotification) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }
    }
    
    private void checkAndRequestPermissions() {
        SharedPreferences prefs = getSharedPreferences("permission_prefs", MODE_PRIVATE);

        // 1) Battery optimization exemption (critical for background delivery)
        boolean batteryExempt = BatteryOptimizationHelper.isIgnoringBatteryOptimizations(this);
        if (!batteryExempt) {
            boolean batteryPromptDone = prefs.getBoolean("battery_prompt_done", false);
            if (!batteryPromptDone) {
                BatteryOptimizationHelper.requestBatteryOptimizationExemption(this);
                prefs.edit().putBoolean("battery_prompt_done", true).apply();
            }
        } else {
            // Mark as done so we don't keep prompting users who already allowed it
            if (!prefs.getBoolean("battery_prompt_done", false)) {
                prefs.edit().putBoolean("battery_prompt_done", true).apply();
            }
        }

        // 2) Xiaomi/Redmi autostart settings: only open once
        if (BatteryOptimizationHelper.isXiaomiDevice()) {
            boolean autostartPromptDone = prefs.getBoolean("autostart_prompt_done", false);
            if (!autostartPromptDone) {
                new android.os.Handler().postDelayed(() -> {
                    BatteryOptimizationHelper.openAutostartSettings(this);
                }, 1200);
                prefs.edit().putBoolean("autostart_prompt_done", true).apply();
            }
        }

        // 3) Android 12+ Full-screen intent: open setting only once if not allowed
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            boolean fullScreenAllowed = notificationManager != null && notificationManager.canUseFullScreenIntent();
            boolean fsPromptDone = prefs.getBoolean("fs_intent_prompt_done", false);
            if (!fullScreenAllowed && !fsPromptDone) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
                intent.setData(Uri.parse("package:" + getPackageName()));
                startActivity(intent);
                prefs.edit().putBoolean("fs_intent_prompt_done", true).apply();
            }
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            
            // Default new orders channel with rich notification features
            NotificationChannel channel = new NotificationChannel(
                "new-orders-v3",
                "New Orders",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notifications for new orders");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 1000, 500, 1000, 500, 1000, 500, 1000});
            channel.setShowBadge(true);
            channel.setBypassDnd(true);
            channel.enableLights(true);
            channel.setLightColor(0xFFFF0000);
            channel.setLockscreenVisibility(androidx.core.app.NotificationCompat.VISIBILITY_PUBLIC);

            // Sound for default channel using system notification ringtone
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build();

            Uri soundUri = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION);
            channel.setSound(soundUri, audioAttributes);
            notificationManager.createNotificationChannel(channel);

            // Call-style channel for urgent bookings with maximum interruption
            NotificationChannel callChannel = new NotificationChannel(
                "booking-calls-v2",
                "Booking Calls",
                NotificationManager.IMPORTANCE_HIGH
            );
            callChannel.setDescription("Incoming booking alerts (call style)");
            callChannel.enableVibration(true);
            callChannel.setVibrationPattern(new long[]{0, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000});
            callChannel.setShowBadge(true);
            callChannel.setBypassDnd(true);
            callChannel.enableLights(true);
            callChannel.setLightColor(0xFFFF0000);
            callChannel.setLockscreenVisibility(androidx.core.app.NotificationCompat.VISIBILITY_PUBLIC);

            // Use ringtone to maximize audibility and lockscreen behavior
            AudioAttributes alarmAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build();

            Uri alarmSound = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_RINGTONE);
            callChannel.setSound(alarmSound, alarmAttributes);
            notificationManager.createNotificationChannel(callChannel);
        }
    }
    
    @CapacitorPlugin(name = "NotificationRoute")
    public static class NotificationRoutePlugin extends Plugin {
        @PluginMethod
        public void getNotificationRoute(PluginCall call) {
            Intent intent = getActivity().getIntent();
            if (intent != null) {
                boolean fromNotification = intent.getBooleanExtra("fromNotification", false);
                String route = intent.getStringExtra("route");
                
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("fromNotification", fromNotification);
                ret.put("route", route != null ? route : "");
                call.resolve(ret);
            } else {
                call.reject("No intent found");
            }
        }
    }
    
    @CapacitorPlugin(name = "NotificationPermission")
    public static class NotificationPermissionPlugin extends Plugin {
        @PluginMethod
        public void requestFullScreenPermission(PluginCall call) {
            // 1) Full-screen intent setting (Android 12+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
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
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
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
