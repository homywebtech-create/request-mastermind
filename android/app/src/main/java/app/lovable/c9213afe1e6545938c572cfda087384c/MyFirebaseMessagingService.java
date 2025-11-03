package app.lovable.c9213afe1e6545938c572cfda087384c;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.view.WindowManager;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import android.util.Log;

public class MyFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "FCMService";
    private static final String CHANNEL_ID = "new-orders-v6";
    private static final String CALL_CHANNEL_ID = "booking-calls-v6";
    private static final String UPDATE_CHANNEL_ID = "app-updates";

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Log.d(TAG, "📬 Message received from: " + remoteMessage.getFrom());

        // ✅ PRIORITY 1: Check for data payload (this is what we're sending now)
        if (remoteMessage.getData().size() > 0) {
            Log.d(TAG, "📦 Message data payload: " + remoteMessage.getData());
            
            // Extract data fields
            String title = remoteMessage.getData().get("title");
            String body = remoteMessage.getData().get("body");
            String type = remoteMessage.getData().get("type");
            String orderId = remoteMessage.getData().get("orderId");
            String route = remoteMessage.getData().get("route");
            
            Log.d(TAG, "🔔 Data Message - Title: " + title);
            Log.d(TAG, "🔔 Data Message - Body: " + body);
            Log.d(TAG, "🔔 Data Message - Type: " + type);
            Log.d(TAG, "🔔 Data Message - OrderID: " + orderId);
            Log.d(TAG, "🔀 Data Message - Route: " + route);
            
            // Handle app update notifications specially - launch custom activity
            if ("app_update".equalsIgnoreCase(type)) {
                Log.d(TAG, "🔄 App update notification received - launching UpdateNotificationActivity");
                Intent updateIntent = new Intent(this, UpdateNotificationActivity.class);
                updateIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                updateIntent.putExtra("version_id", remoteMessage.getData().get("version_id"));
                updateIntent.putExtra("version_code", remoteMessage.getData().get("version_code"));
                updateIntent.putExtra("version_name", remoteMessage.getData().get("version_name"));
                updateIntent.putExtra("apk_url", remoteMessage.getData().get("apk_url"));
                updateIntent.putExtra("is_mandatory", remoteMessage.getData().get("is_mandatory"));
                updateIntent.putExtra("changelog", remoteMessage.getData().get("changelog"));
                startActivity(updateIntent);
                return;
            }
            
            boolean useCallChannel = "new_order".equalsIgnoreCase(type) || "test".equalsIgnoreCase(type);
            // ✅ Show notification with full-screen intent (works when app is closed!)
            sendHighPriorityNotification(
                title != null ? title : "طلب جديد",
                body != null ? body : "لديك طلب جديد",
                route != null ? route : "/specialist-orders/new",
                useCallChannel
            );
        }
        // Fallback: Check if message contains a notification payload (backward compatibility)
        else if (remoteMessage.getNotification() != null) {
            Log.d(TAG, "📧 Notification payload received (fallback)");
            String title = remoteMessage.getNotification().getTitle();
            String body = remoteMessage.getNotification().getBody();
            
            sendHighPriorityNotification(title, body, "/specialist-orders/new", true);
        }
        else {
            Log.w(TAG, "⚠️ Message received but no data or notification payload");
        }
    }

    @Override
    public void onNewToken(String token) {
        Log.d(TAG, "🎟️ New FCM token: " + token);
        // Token will be handled by Capacitor plugin
    }

    private void sendHighPriorityNotification(String title, String body, String route, boolean useCallChannel) {
        // Only show full-screen interface for new orders
        if (!useCallChannel) {
            Log.d(TAG, "ℹ️ Not a new order notification - skipping full-screen interface");
            // Show normal notification for non-new-order types
            createNotificationChannel();
            
            Uri deepLink = Uri.parse("request-mastermind://open?route=" + Uri.encode(route));
            Intent intent = new Intent(Intent.ACTION_VIEW, deepLink);
            intent.setPackage(getPackageName());
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            
            PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, intent, 
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            
            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_icon_config_sample)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);
                
            NotificationManager notificationManager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            notificationManager.notify((int) System.currentTimeMillis(), builder.build());
            return;
        }
        
        // Wake up the screen first for new orders
        wakeUpScreen();
        
        // Create notification channels (required for Android 8.0+)
        createNotificationChannel();

        // Use CALL channel for new orders (maximum interruption)
        String channelId = CALL_CHANNEL_ID;

        // Extract orderId from route if present
        String orderId = null;
        if (route != null && route.contains("orderId=")) {
            orderId = route.split("orderId=")[1].split("&")[0];
        }

        // Intent to launch MainActivity when notification is tapped (deep link)
        Uri deepLink = Uri.parse("request-mastermind://open?route=" + Uri.encode(route));
        Intent intent = new Intent(Intent.ACTION_VIEW, deepLink);
        intent.setPackage(getPackageName());
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("fromNotification", true);
        intent.putExtra("route", route);
        
        // Full-screen intent - launches custom Activity for incoming orders (fallback for other devices)
        Intent fullScreenIntent = new Intent(this, IncomingOrderActivity.class);
        fullScreenIntent.setFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK | 
            Intent.FLAG_ACTIVITY_CLEAR_TOP | 
            Intent.FLAG_ACTIVITY_NO_HISTORY
        );
        fullScreenIntent.addFlags(WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        fullScreenIntent.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        fullScreenIntent.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED);
        fullScreenIntent.addFlags(WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);
        fullScreenIntent.putExtra("title", title);
        fullScreenIntent.putExtra("body", body);
        fullScreenIntent.putExtra("route", route);
        fullScreenIntent.putExtra("orderId", orderId);

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 
            0, 
            intent, 
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
            this,
            1,
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Use device's default phone ringtone
        Uri defaultRingtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);

        // Long vibration pattern (10 seconds of continuous vibration)
        long[] vibrationPattern = new long[]{0, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000};

        // Build the notification with maximum priority and ensure both sound and UI appear
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_stat_icon_config_sample)
            .setContentTitle(title != null ? title : "طلب جديد")
            .setContentText(body != null ? body : "لديك طلب جديد")
            .setStyle(new NotificationCompat.BigTextStyle()
                .bigText(body != null ? body : "لديك طلب جديد")
                .setBigContentTitle(title != null ? title : "طلب جديد"))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL) // Always use CALL category for maximum interruption
            .setAutoCancel(true)
            .setSound(defaultRingtoneUri) // Use device's default phone ringtone
            .setVibrate(vibrationPattern) // Explicitly set vibration
            .setContentIntent(pendingIntent)
            .setFullScreenIntent(fullScreenPendingIntent, true) // Wake screen
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC) // Show on lock screen
            .setColor(0xFFFF0000)
            .setLights(0xFFFF0000, 500, 500)
            .setOngoing(channelId.equals(CALL_CHANNEL_ID))
            .setTimeoutAfter(30000)
            .setDefaults(0) // Don't use defaults, use explicit settings
            .setOnlyAlertOnce(false); // Alert every time

        // Show the notification
        NotificationManager notificationManager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        notificationManager.notify((int) System.currentTimeMillis(), builder.build());
        
        Log.d(TAG, "✅ High-priority notification sent with sound + UI on channel: " + channelId);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = getSystemService(NotificationManager.class);

            // If channels exist with lower importance, delete to recreate with MAX
            try {
                NotificationChannel existing1 = notificationManager.getNotificationChannel(CHANNEL_ID);
                if (existing1 != null && existing1.getImportance() < NotificationManager.IMPORTANCE_MAX) {
                    notificationManager.deleteNotificationChannel(CHANNEL_ID);
                }
                NotificationChannel existing2 = notificationManager.getNotificationChannel(CALL_CHANNEL_ID);
                if (existing2 != null && existing2.getImportance() < NotificationManager.IMPORTANCE_MAX) {
                    notificationManager.deleteNotificationChannel(CALL_CHANNEL_ID);
                }
            } catch (Exception ignored) {}

            // Unified audio attributes for both channels
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build();
            Uri defaultRingtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            long[] vibrationPattern = new long[]{0, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000};

            // Default channel with MAXIMUM interruption (IMPORTANCE_MAX for lock screen)
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "New Orders",
                NotificationManager.IMPORTANCE_MAX
            );
            channel.setDescription("Notifications for new orders");
            channel.enableVibration(true);
            channel.setVibrationPattern(vibrationPattern);
            channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
            channel.setShowBadge(true);
            channel.setBypassDnd(true);
            channel.enableLights(true);
            channel.setLightColor(0xFFFF0000);
            channel.setSound(defaultRingtoneUri, audioAttributes);
            notificationManager.createNotificationChannel(channel);

            // Call-style channel with MAXIMUM interruption (IMPORTANCE_MAX for lock screen)
            NotificationChannel callChannel = new NotificationChannel(
                CALL_CHANNEL_ID,
                "Booking Calls",
                NotificationManager.IMPORTANCE_MAX
            );
            callChannel.setDescription("Incoming booking alerts (call style)");
            callChannel.enableVibration(true);
            callChannel.setVibrationPattern(vibrationPattern);
            callChannel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
            callChannel.setShowBadge(true);
            callChannel.setBypassDnd(true);
            callChannel.enableLights(true);
            callChannel.setLightColor(0xFFFF0000);
            callChannel.setSound(defaultRingtoneUri, audioAttributes);
            notificationManager.createNotificationChannel(callChannel);

            Log.d(TAG, "✅ Notification channels ensured with consistent sound + vibration (" + CHANNEL_ID + ", " + CALL_CHANNEL_ID + ")");
            
            // App Updates channel (HIGH priority, not MAX - less intrusive)
            NotificationChannel updateChannel = new NotificationChannel(
                UPDATE_CHANNEL_ID,
                "App Updates",
                NotificationManager.IMPORTANCE_HIGH
            );
            updateChannel.setDescription("Notifications for app updates");
            updateChannel.enableVibration(true);
            updateChannel.setVibrationPattern(new long[]{0, 500, 200, 500});
            updateChannel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
            updateChannel.setShowBadge(true);
            updateChannel.setSound(defaultRingtoneUri, audioAttributes);
            notificationManager.createNotificationChannel(updateChannel);
            
            Log.d(TAG, "✅ Update channel created: " + UPDATE_CHANNEL_ID);
        }
    }

    /**
     * Handle app update notifications with action buttons
     */
    private void sendAppUpdateNotification(java.util.Map<String, String> data) {
        createNotificationChannel();
        
        String title = data.get("title");
        String body = data.get("body");
        String versionName = data.get("version_name");
        String apkUrl = data.get("apk_url");
        String changelog = data.get("changelog");
        String isMandatory = data.get("is_mandatory");
        String route = data.get("route");
        
        if (title == null) title = "تحديث متوفر";
        if (body == null) body = "إصدار جديد من التطبيق";
        if (route == null) route = "/specialist-orders?showUpdate=true";
        
        Log.d(TAG, "🔄 Creating update notification - Version: " + versionName);
        Log.d(TAG, "🔄 APK URL: " + apkUrl);
        Log.d(TAG, "🔄 Mandatory: " + isMandatory);
        
        // Create intent to open app and show update dialog
        Uri deepLink = Uri.parse("request-mastermind://open?route=" + Uri.encode(route));
        Intent intent = new Intent(Intent.ACTION_VIEW, deepLink);
        intent.setPackage(getPackageName());
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 
            (int) System.currentTimeMillis(), 
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        
        // Build notification with action button
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, UPDATE_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_icon_config_sample)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle()
                .bigText(changelog != null && !changelog.isEmpty() ? changelog : body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setColor(0xFF0066FF);
        
        // Add "Update Now" action button
        builder.addAction(
            R.drawable.ic_stat_icon_config_sample,
            "تحديث الآن",
            pendingIntent
        );
        
        // Show notification
        NotificationManager notificationManager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        notificationManager.notify(999, builder.build()); // Use fixed ID 999 for updates
        
        Log.d(TAG, "✅ App update notification displayed with action button");
    }

    /**
     * Wake up the device screen when notification arrives
     * Enhanced for Xiaomi/Redmi devices with aggressive power management
     */
    private void wakeUpScreen() {
        try {
            PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
            if (powerManager != null) {
                // Use FULL_WAKE_LOCK for maximum screen wake capability (especially for Xiaomi)
                PowerManager.WakeLock wakeLock = powerManager.newWakeLock(
                    PowerManager.FULL_WAKE_LOCK | 
                    PowerManager.ACQUIRE_CAUSES_WAKEUP | 
                    PowerManager.ON_AFTER_RELEASE,
                    "RequestMastermind:NotificationWakeLock"
                );
                
                // Acquire wake lock for 15 seconds (longer duration for MIUI)
                wakeLock.acquire(15000);
                
                Log.d(TAG, "📱 Full screen wake lock acquired (MIUI-optimized)");
                
                // Release the wake lock after a delay
                new android.os.Handler().postDelayed(() -> {
                    if (wakeLock.isHeld()) {
                        wakeLock.release();
                        Log.d(TAG, "📱 Screen wake lock released");
                    }
                }, 12000);
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Error waking screen: " + e.getMessage());
        }
    }
}
