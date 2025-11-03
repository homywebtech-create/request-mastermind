package app.lovable.c9213afe1e6545938c572cfda087384c;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;

@CapacitorPlugin(name = "UpdateBroadcastReceiver")
public class UpdateBroadcastReceiver extends BroadcastReceiver {
    private static final String UPDATE_ACTION = "app.lovable.UPDATE_ACTION";
    private static final String CLOSE_APP = "app.lovable.CLOSE_APP";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        
        if (UPDATE_ACTION.equals(action)) {
            try {
                JSONObject data = new JSONObject();
                data.put("version_id", intent.getStringExtra("version_id"));
                data.put("version_code", intent.getStringExtra("version_code"));
                data.put("version_name", intent.getStringExtra("version_name"));
                data.put("apk_url", intent.getStringExtra("apk_url"));
                data.put("is_mandatory", intent.getStringExtra("is_mandatory"));
                data.put("changelog", intent.getStringExtra("changelog"));

                // Send to JavaScript
                MainActivity.getWebView().evaluateJavascript(
                    "if (window.UpdateBroadcastReceiver && window.UpdateBroadcastReceiver.onUpdateAction) { " +
                    "window.UpdateBroadcastReceiver.onUpdateAction('" + data.toString().replace("'", "\\'") + "'); " +
                    "}", null);
            } catch (Exception e) {
                e.printStackTrace();
            }
        } else if (CLOSE_APP.equals(action)) {
            // Send close app signal to JavaScript
            MainActivity.getWebView().evaluateJavascript(
                "if (window.UpdateBroadcastReceiver && window.UpdateBroadcastReceiver.onCloseApp) { " +
                "window.UpdateBroadcastReceiver.onCloseApp(); " +
                "}", null);
        }
    }

    public static void register(Context context) {
        IntentFilter filter = new IntentFilter();
        filter.addAction(UPDATE_ACTION);
        filter.addAction(CLOSE_APP);
        context.registerReceiver(new UpdateBroadcastReceiver(), filter);
    }
}
