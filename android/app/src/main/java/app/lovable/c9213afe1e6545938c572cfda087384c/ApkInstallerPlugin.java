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

            Intent intent = new Intent(Intent.ACTION_VIEW);
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                // For Android 7.0 and above, use FileProvider
                android.util.Log.d("ApkInstaller", "🔧 Using FileProvider for Android N+");
                
                String authority = getContext().getPackageName() + ".fileprovider";
                android.util.Log.d("ApkInstaller", "🔧 FileProvider authority: " + authority);
                
                Uri apkUri = FileProvider.getUriForFile(
                    getContext(),
                    authority,
                    file
                );
                
                android.util.Log.d("ApkInstaller", "🔧 FileProvider URI: " + apkUri.toString());
                
                intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } else {
                // For older Android versions
                android.util.Log.d("ApkInstaller", "🔧 Using direct file URI for older Android");
                intent.setDataAndType(Uri.fromFile(file), "application/vnd.android.package-archive");
            }
            
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            
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
