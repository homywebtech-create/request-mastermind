package app.lovable.c9213afe1e6545938c572cfda087384c;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;
import android.util.Log;

public class IncomingOrderActivity extends Activity {
    private static final String TAG = "IncomingOrderActivity";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Ensure screen wakes and shows over lock screen on all versions
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            // Keep screen on while activity is visible
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            );
        }

        // Explicitly request to dismiss keyguard if locked (helps on MIUI)
        try {
            android.app.KeyguardManager km = (android.app.KeyguardManager) getSystemService(KEYGUARD_SERVICE);
            if (km != null && km.isKeyguardLocked()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    km.requestDismissKeyguard(this, null);
                } else {
                    getWindow().addFlags(WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Error dismissing keyguard: " + e.getMessage());
        }

        setContentView(R.layout.activity_incoming_order);

        // Get data from intent
        String title = getIntent().getStringExtra("title");
        String body = getIntent().getStringExtra("body");
        String route = getIntent().getStringExtra("route");
        String orderId = getIntent().getStringExtra("orderId");

        Log.d(TAG, "📱 Full-screen activity launched - Title: " + title + ", Route: " + route);

        // Set the text
        TextView titleView = findViewById(R.id.orderTitle);
        TextView bodyView = findViewById(R.id.orderBody);
        
        if (titleView != null && title != null) {
            titleView.setText(title);
        }
        if (bodyView != null && body != null) {
            bodyView.setText(body);
        }

        // Skip button
        Button skipButton = findViewById(R.id.skipButton);
        skipButton.setOnClickListener(v -> {
            Log.d(TAG, "⏭️ Skip button clicked");
            // Navigate to the offer page
            navigateToApp(route != null ? route : "/specialist-orders/new");
            finish();
        });

        // Submit Quote button
        Button submitButton = findViewById(R.id.submitQuoteButton);
        submitButton.setOnClickListener(v -> {
            Log.d(TAG, "💰 Submit Quote button clicked");
            // Navigate to the pricing selection page
            String submitRoute = orderId != null ? "/specialist-orders/new?orderId=" + orderId : route;
            navigateToApp(submitRoute != null ? submitRoute : "/specialist-orders/new");
            finish();
        });
    }

    private void navigateToApp(String route) {
        try {
            Uri deepLink = Uri.parse("request-mastermind://open?route=" + Uri.encode(route));
            Intent intent = new Intent(Intent.ACTION_VIEW, deepLink);
            intent.setPackage(getPackageName());
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            intent.putExtra("fromNotification", true);
            intent.putExtra("route", route);
            startActivity(intent);
            Log.d(TAG, "✅ Navigating to: " + route);
        } catch (Exception e) {
            Log.e(TAG, "❌ Error navigating: " + e.getMessage());
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "🔚 Full-screen activity destroyed");
    }
}
