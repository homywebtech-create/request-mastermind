package app.lovable.c9213afe1e6545938c572cfda087384c;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;

/**
 * Helper class for handling battery optimization exemption requests
 * Critical for Xiaomi/Redmi/MIUI/HyperOS devices where aggressive battery management
 * kills background processes and prevents FCM notifications when app is closed
 */
public class BatteryOptimizationHelper {
    private static final String TAG = "BatteryOptimization";

    /**
     * Check if the app is already whitelisted from battery optimizations
     */
    public static boolean isIgnoringBatteryOptimizations(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (powerManager != null) {
                boolean isIgnoring = powerManager.isIgnoringBatteryOptimizations(context.getPackageName());
                Log.d(TAG, "Battery optimization status: " + (isIgnoring ? "EXEMPTED" : "RESTRICTED"));
                return isIgnoring;
            }
        }
        return true; // Pre-M devices don't have battery optimization
    }

    /**
     * Request battery optimization exemption
     * Opens the battery optimization settings screen for the app
     */
    public static void requestBatteryOptimizationExemption(Activity activity) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager powerManager = (PowerManager) activity.getSystemService(Context.POWER_SERVICE);
            
            if (powerManager != null && !powerManager.isIgnoringBatteryOptimizations(activity.getPackageName())) {
                Log.d(TAG, "Requesting battery optimization exemption...");
                
                try {
                    // Use ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
                    // This shows an in-app dialog without leaving the app
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + activity.getPackageName()));
                    activity.startActivity(intent);
                    Log.d(TAG, "✅ Battery optimization exemption dialog shown");
                } catch (Exception e) {
                    Log.e(TAG, "❌ Failed to request battery optimization exemption", e);
                    
                    // Fallback: Open app details settings
                    try {
                        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                        intent.setData(Uri.parse("package:" + activity.getPackageName()));
                        activity.startActivity(intent);
                        Log.d(TAG, "✅ Opened app settings as fallback");
                    } catch (Exception e2) {
                        Log.e(TAG, "❌ Failed to open app settings", e2);
                    }
                }
            } else {
                Log.d(TAG, "App is already exempted from battery optimization");
            }
        }
    }

    /**
     * Check if the device is a Xiaomi/Redmi device
     */
    public static boolean isXiaomiDevice() {
        String manufacturer = Build.MANUFACTURER.toLowerCase();
        boolean isXiaomi = manufacturer.contains("xiaomi") || manufacturer.contains("redmi");
        if (isXiaomi) {
            Log.d(TAG, "🔍 Xiaomi/Redmi device detected: " + Build.MANUFACTURER + " " + Build.MODEL);
        }
        return isXiaomi;
    }

    /**
     * Open autostart settings (Xiaomi specific)
     * This is critical for MIUI/HyperOS to allow the app to start in background
     */
    public static void openAutostartSettings(Activity activity) {
        if (!isXiaomiDevice()) {
            Log.d(TAG, "Not a Xiaomi device, skipping autostart settings");
            return;
        }

        Log.d(TAG, "Opening autostart settings for Xiaomi device...");
        
        try {
            // Try MIUI autostart settings
            Intent intent = new Intent();
            intent.setClassName("com.miui.securitycenter",
                    "com.miui.permcenter.autostart.AutoStartManagementActivity");
            activity.startActivity(intent);
            Log.d(TAG, "✅ Opened MIUI autostart settings");
        } catch (Exception e) {
            Log.e(TAG, "Failed to open MIUI autostart settings", e);
            
            try {
                // Fallback: Try HyperOS autostart settings
                Intent intent = new Intent();
                intent.setClassName("com.miui.securitycenter",
                        "com.miui.appmanager.ApplicationsDetailsActivity");
                intent.putExtra("package_name", activity.getPackageName());
                activity.startActivity(intent);
                Log.d(TAG, "✅ Opened HyperOS autostart settings");
            } catch (Exception e2) {
                Log.e(TAG, "Failed to open HyperOS autostart settings", e2);
                
                // Last resort: Open app settings
                try {
                    Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    intent.setData(Uri.parse("package:" + activity.getPackageName()));
                    activity.startActivity(intent);
                    Log.d(TAG, "✅ Opened app settings as fallback");
                } catch (Exception e3) {
                    Log.e(TAG, "❌ All methods failed", e3);
                }
            }
        }
    }
}
