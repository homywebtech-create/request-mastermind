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
        createNotificationChannel();
        checkAndRequestPermissions();
    }
    
    private void checkAndRequestPermissions() {
        // For Android 12+ (API 31+), check if app can use full screen intents
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
                "new-orders",
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
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                NotificationManager notificationManager = getContext().getSystemService(NotificationManager.class);
                if (notificationManager != null && !notificationManager.canUseFullScreenIntent()) {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
                    intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                    getActivity().startActivity(intent);
                    call.resolve();
                } else {
                    call.resolve();
                }
            } else {
                call.resolve();
            }
        }
        
        @PluginMethod
        public void checkFullScreenPermission(PluginCall call) {
            boolean hasPermission = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                NotificationManager notificationManager = getContext().getSystemService(NotificationManager.class);
                hasPermission = notificationManager != null && notificationManager.canUseFullScreenIntent();
            }
            call.resolve(new com.getcapacitor.JSObject().put("hasPermission", hasPermission));
        }
    }
}
