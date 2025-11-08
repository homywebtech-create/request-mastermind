package app.lovable.c9213afe1e6545938c572cfda087384c;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {

    @PluginMethod
    public void installApk(PluginCall call) {
        String filePath = call.getString("filePath");
        
        android.util.Log.d("ApkInstaller", "📦 installApk called with filePath: " + filePath);
        
        if (filePath == null || filePath.isEmpty()) {
            android.util.Log.e("ApkInstaller", "❌ File path is null or empty");
            call.reject("File path is required");
            return;
        }

        try {
            File file = new File(filePath);
            
            android.util.Log.d("ApkInstaller", "📂 File object created: " + file.getAbsolutePath());
            android.util.Log.d("ApkInstaller", "📂 File exists: " + file.exists());
            android.util.Log.d("ApkInstaller", "📂 File size: " + file.length());
            
            if (!file.exists()) {
                android.util.Log.e("ApkInstaller", "❌ APK file not found at path: " + filePath);
                call.reject("APK file not found at: " + filePath);
                return;
            }

            String authority = getContext().getPackageName() + ".fileprovider";
            android.util.Log.d("ApkInstaller", "🔧 FileProvider authority: " + authority);
            
            Uri apkUri = FileProvider.getUriForFile(
                getContext(),
                authority,
                file
            );
            
            android.util.Log.d("ApkInstaller", "🔧 FileProvider URI: " + apkUri.toString());
            
            Intent intent;
            
            // Use ACTION_INSTALL_PACKAGE for direct installation (API 24+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                android.util.Log.d("ApkInstaller", "🚀 Using ACTION_INSTALL_PACKAGE for direct install");
                intent = new Intent(Intent.ACTION_INSTALL_PACKAGE);
                intent.setData(apkUri);
                intent.setFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true);
                intent.putExtra(Intent.EXTRA_RETURN_RESULT, true);
            } else {
                // Fallback for older Android (API 23-)
                android.util.Log.d("ApkInstaller", "🔧 Using ACTION_VIEW fallback for older Android");
                intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(Uri.fromFile(file), "application/vnd.android.package-archive");
            }
            
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            
            android.util.Log.d("ApkInstaller", "🚀 Starting install activity...");
            getContext().startActivity(intent);
            
            android.util.Log.d("ApkInstaller", "✅ Install activity started successfully");
            
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
            
        } catch (Exception e) {
            android.util.Log.e("ApkInstaller", "❌ Failed to install APK: " + e.getMessage());
            android.util.Log.e("ApkInstaller", "❌ Exception details: ", e);
            call.reject("Failed to install APK: " + e.getMessage());
        }
    }
}
