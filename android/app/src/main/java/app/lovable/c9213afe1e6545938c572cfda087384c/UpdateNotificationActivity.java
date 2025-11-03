package app.lovable.c9213afe1e6545938c572cfda087384c;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.Animation;
import android.view.animation.TranslateAnimation;
import android.widget.Button;
import android.widget.TextView;
import android.widget.LinearLayout;

public class UpdateNotificationActivity extends Activity {
    private String versionId;
    private String versionCode;
    private String versionName;
    private String apkUrl;
    private boolean isMandatory;
    private String changelog;
    private LinearLayout notificationContainer;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Make activity full screen and show over lock screen
        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
        );
        
        setContentView(R.layout.activity_update_notification);

        // Get data from intent
        Intent intent = getIntent();
        versionId = intent.getStringExtra("version_id");
        versionCode = intent.getStringExtra("version_code");
        versionName = intent.getStringExtra("version_name");
        apkUrl = intent.getStringExtra("apk_url");
        isMandatory = "true".equals(intent.getStringExtra("is_mandatory"));
        changelog = intent.getStringExtra("changelog");

        // Setup UI
        notificationContainer = findViewById(R.id.notification_container);
        TextView titleText = findViewById(R.id.update_title);
        TextView messageText = findViewById(R.id.update_message);
        TextView changelogText = findViewById(R.id.update_changelog);
        Button updateButton = findViewById(R.id.update_button);
        Button skipButton = findViewById(R.id.skip_button);

        // Set content
        titleText.setText("New Update Available");
        messageText.setText("Version " + versionName + " is now available");
        
        if (changelog != null && !changelog.isEmpty()) {
            changelogText.setText(changelog);
            changelogText.setVisibility(View.VISIBLE);
        } else {
            changelogText.setVisibility(View.GONE);
        }

        if (isMandatory) {
            skipButton.setText("Close App");
        } else {
            skipButton.setText("Skip");
        }

        // Button handlers
        updateButton.setOnClickListener(v -> {
            // Broadcast update action to the app
            Intent updateIntent = new Intent("app.lovable.UPDATE_ACTION");
            updateIntent.putExtra("version_id", versionId);
            updateIntent.putExtra("version_code", versionCode);
            updateIntent.putExtra("version_name", versionName);
            updateIntent.putExtra("apk_url", apkUrl);
            updateIntent.putExtra("is_mandatory", String.valueOf(isMandatory));
            updateIntent.putExtra("changelog", changelog);
            sendBroadcast(updateIntent);
            finish();
        });

        skipButton.setOnClickListener(v -> {
            if (isMandatory) {
                // Close the app
                Intent closeIntent = new Intent("app.lovable.CLOSE_APP");
                sendBroadcast(closeIntent);
                finishAffinity();
            } else {
                // Just close the notification
                finish();
            }
        });

        // Slide up animation
        slideUp();
    }

    private void slideUp() {
        TranslateAnimation animate = new TranslateAnimation(
            0,
            0,
            notificationContainer.getHeight(),
            0
        );
        animate.setDuration(300);
        animate.setFillAfter(true);
        notificationContainer.startAnimation(animate);
    }

    @Override
    public void onBackPressed() {
        if (!isMandatory) {
            super.onBackPressed();
        }
        // If mandatory, prevent back button
    }
}
