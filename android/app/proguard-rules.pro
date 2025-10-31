# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ============= FIREBASE & NOTIFICATIONS =============
# Keep Firebase classes (CRITICAL for notifications in release builds)
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Keep FCM messaging service
-keep class app.lovable.c9213afe1e6545938c572cfda087384c.MyFirebaseMessagingService { *; }

# Keep incoming order activity
-keep class app.lovable.c9213afe1e6545938c572cfda087384c.IncomingOrderActivity { *; }

# Keep notification classes
-keep class androidx.core.app.NotificationCompat** { *; }
-keep class android.app.Notification** { *; }

# Keep Capacitor plugins
-keep class com.getcapacitor.** { *; }
-dontwarn com.getcapacitor.**

# Keep push notification plugin
-keep class com.capacitor.pushnotifications.** { *; }
-dontwarn com.capacitor.pushnotifications.**

# Keep custom Capacitor plugin for permissions
-keep class app.lovable.c9213afe1e6545938c572cfda087384c.MainActivity$NotificationPermissionPlugin { *; }
