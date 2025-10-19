package app.lovable.c9213afe1e6545938c572cfda087384c;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import android.util.Log;

public class MyFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "FCMService";
    private static final String CHANNEL_ID = "new-orders-v3";
    private static final String CALL_CHANNEL_ID = "booking-calls-v2";

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
            
            Log.d(TAG, "🔔 Data Message - Title: " + title);
            Log.d(TAG, "🔔 Data Message - Body: " + body);
            Log.d(TAG, "🔔 Data Message - Type: " + type);
            Log.d(TAG, "🔔 Data Message - OrderID: " + orderId);
            
            boolean useCallChannel = "new_order".equalsIgnoreCase(type) || "test".equalsIgnoreCase(type);
            // ✅ Show notification with full-screen intent (works when app is closed!)
            sendHighPriorityNotification(
                title != null ? title : "طلب جديد",
                body != null ? body : "لديك طلب جديد",
                useCallChannel
            );
        }
        // Fallback: Check if message contains a notification payload (backward compatibility)
        else if (remoteMessage.getNotification() != null) {
            Log.d(TAG, "📧 Notification payload received (fallback)");
            String title = remoteMessage.getNotification().getTitle();
            String body = remoteMessage.getNotification().getBody();
            
            sendHighPriorityNotification(title, body, true);
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

    private void sendHighPriorityNotification(String title, String body, boolean useCallChannel) {
        // Create notification channels (required for Android 8.0+)
        createNotificationChannel();

        // Choose channel depending on type
        String channelId = useCallChannel ? CALL_CHANNEL_ID : CHANNEL_ID;

        // Intent to launch MainActivity when notification is tapped
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("route", "/specialist/new-orders");
        
        // Full-screen intent (like incoming call)
        Intent fullScreenIntent = new Intent(this, MainActivity.class);
        fullScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        fullScreenIntent.putExtra("fromNotification", true);
        fullScreenIntent.putExtra("route", "/specialist/new-orders");

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

        // Custom sounds (pre-O only; O+ uses channel sound)
        Uri defaultSound = Uri.parse("android.resource://" + getPackageName() + "/raw/short_notification");
        Uri callSound = Uri.parse("android.resource://" + getPackageName() + "/raw/notification_sound");
        Uri soundUri = useCallChannel ? callSound : defaultSound;

        // Build the notification with maximum priority
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_stat_icon_config_sample)
            .setContentTitle(title != null ? title : "طلب جديد")
            .setContentText(body != null ? body : "لديك طلب جديد")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(useCallChannel ? NotificationCompat.CATEGORY_CALL : NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setSound(soundUri)
            .setVibrate(new long[]{0, 1000, 500, 1000})
            .setContentIntent(pendingIntent)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

        // Show the notification
        NotificationManager notificationManager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        notificationManager.notify((int) System.currentTimeMillis(), builder.build());
        
        Log.d(TAG, "✅ High-priority notification sent with full-screen intent on channel: " + channelId);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = getSystemService(NotificationManager.class);

            // Default channel
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "New Orders",
                NotificationManager.IMPORTANCE_MAX
            );
            channel.setDescription("Notifications for new orders");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 1000, 500, 1000});
            channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
            channel.setShowBadge(true);
            channel.setBypassDnd(true);

            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();
            Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/raw/short_notification");
            channel.setSound(soundUri, audioAttributes);
            notificationManager.createNotificationChannel(channel);

            // Call-style channel
            NotificationChannel callChannel = new NotificationChannel(
                CALL_CHANNEL_ID,
                "Booking Calls",
                NotificationManager.IMPORTANCE_MAX
            );
            callChannel.setDescription("Incoming booking alerts (call style)");
            callChannel.enableVibration(true);
            callChannel.setVibrationPattern(new long[]{0, 1000, 500, 1000});
            callChannel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
            callChannel.setShowBadge(true);
            callChannel.setBypassDnd(true);

            AudioAttributes alarmAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build();
            Uri alarmSound = Uri.parse("android.resource://" + getPackageName() + "/raw/notification_sound");
            callChannel.setSound(alarmSound, alarmAttributes);
            notificationManager.createNotificationChannel(callChannel);

            Log.d(TAG, "✅ Notification channels ensured (" + CHANNEL_ID + ", " + CALL_CHANNEL_ID + ")");
        }
    }
}
