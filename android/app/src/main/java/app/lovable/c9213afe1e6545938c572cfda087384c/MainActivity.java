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
        createNotificationChannel();
        checkAndRequestPermissions();
        ensureWakeAndShowIfFromNotification(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        ensureWakeAndShowIfFromNotification(intent);
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
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
            // Default new orders channel (heads-up)
            NotificationChannel channel = new NotificationChannel(
                "new-orders-v2",
                "New Orders",
                NotificationManager.IMPORTANCE_MAX  // Maximum priority
            );
            channel.setDescription("Notifications for new orders");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 300, 100, 300});
            channel.setShowBadge(true);
            channel.setBypassDnd(true);

            // Sound for default channel
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();

            Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/raw/short_notification");
            channel.setSound(soundUri, audioAttributes);

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(channel);

            // Call-style channel for urgent bookings (full-screen intent)
            NotificationChannel callChannel = new NotificationChannel(
                "booking-calls",
                "Booking Calls",
                NotificationManager.IMPORTANCE_MAX
            );
            callChannel.setDescription("Incoming booking alerts (call style)");
            callChannel.enableVibration(true);
            callChannel.setVibrationPattern(new long[]{0, 1000, 500, 1000});
            callChannel.setShowBadge(true);
            callChannel.setBypassDnd(true);
            callChannel.setLockscreenVisibility(androidx.core.app.NotificationCompat.VISIBILITY_PUBLIC);

            // Use ALARM usage to maximize audibility and lockscreen behavior
            AudioAttributes alarmAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build();

            Uri alarmSound = Uri.parse("android.resource://" + getPackageName() + "/raw/notification_sound");
            callChannel.setSound(alarmSound, alarmAttributes);

            notificationManager.createNotificationChannel(callChannel);
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
