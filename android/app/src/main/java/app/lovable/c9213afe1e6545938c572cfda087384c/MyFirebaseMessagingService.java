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
        // Wake up the screen first
        wakeUpScreen();
        
        // Create notification channels (required for Android 8.0+)
        createNotificationChannel();

        // Choose channel depending on type
        String channelId = useCallChannel ? CALL_CHANNEL_ID : CHANNEL_ID;

        // Intent to launch MainActivity when notification is tapped (deep link)
        Uri deepLink = Uri.parse("request-mastermind://open?route=" + Uri.encode(route));
        Intent intent = new Intent(Intent.ACTION_VIEW, deepLink);
        intent.setPackage(getPackageName());
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("fromNotification", true);
        intent.putExtra("route", route);
        
        // Full-screen intent (like incoming call) - wake screen and show over lockscreen
        Intent fullScreenIntent = new Intent(Intent.ACTION_VIEW, deepLink);
        fullScreenIntent.setPackage(getPackageName());
        fullScreenIntent.setFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK | 
            Intent.FLAG_ACTIVITY_CLEAR_TOP | 
            Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS
        );
        fullScreenIntent.putExtra("fromNotification", true);
        fullScreenIntent.putExtra("route", route);

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
            .setOngoing(false)
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

            // Unified audio attributes for both channels
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build();
            Uri defaultRingtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            long[] vibrationPattern = new long[]{0, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000};

            // Default channel with maximum interruption
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "New Orders",
                NotificationManager.IMPORTANCE_HIGH
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

            // Call-style channel with identical settings for consistency
            NotificationChannel callChannel = new NotificationChannel(
                CALL_CHANNEL_ID,
                "Booking Calls",
                NotificationManager.IMPORTANCE_HIGH
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
        }
    }

    /**
     * Wake up the device screen when notification arrives
     */
    private void wakeUpScreen() {
        try {
            PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
            if (powerManager != null) {
                // Create wake lock with screen on flag
                PowerManager.WakeLock wakeLock = powerManager.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK | 
                    PowerManager.ACQUIRE_CAUSES_WAKEUP | 
                    PowerManager.ON_AFTER_RELEASE,
                    "RequestMastermind:NotificationWakeLock"
                );
                
                // Acquire wake lock for 10 seconds to wake the screen
                wakeLock.acquire(10000);
                
                Log.d(TAG, "📱 Screen wake lock acquired");
                
                // Release the wake lock after a delay
                // (The FLAG will keep screen on for a bit even after release)
                new android.os.Handler().postDelayed(() -> {
                    if (wakeLock.isHeld()) {
                        wakeLock.release();
                        Log.d(TAG, "📱 Screen wake lock released");
                    }
                }, 8000);
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Error waking screen: " + e.getMessage());
        }
    }
}
