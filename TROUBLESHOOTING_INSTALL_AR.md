# 🔧 دليل حل مشاكل البناء والتثبيت

---

## 🛠️ مشاكل البناء (Build Errors)

### ❌ مشكلة: "Daemon compilation failed: Could not connect to Kotlin compile daemon"

**الأعراض**:
- Build android: failed
- RuntimeException: Could not connect to Kotlin compile daemon
- Waited 10 minutes for SettableFuture

**الحلول** (جرّبها بالترتيب):

#### 1️⃣ إيقاف Gradle Daemon وإعادة تشغيله

```bash
# في Terminal داخل Android Studio أو في مجلد المشروع

# إيقاف جميع Gradle daemons
./gradlew --stop

# أو على Windows
gradlew.bat --stop

# ثم أعد البناء
./gradlew clean build
```

#### 2️⃣ مسح Cache وإعادة البناء

**في Android Studio**:
1. `File` → `Invalidate Caches...`
2. اختر: ✅ `Clear file system cache`
3. اختر: ✅ `Clear VCS Log cache`
4. اضغط `Invalidate and Restart`

**أو عبر Terminal**:
```bash
# في مجلد android/
cd android

# حذف الكاش والملفات المؤقتة
rm -rf .gradle/
rm -rf build/
rm -rf app/build/

# على Windows استخدم:
# rmdir /s /q .gradle
# rmdir /s /q build
# rmdir /s /q app\build

# إعادة البناء
cd ..
npx cap sync android
```

#### 3️⃣ التحقق من إصدار Java/JDK

**المشكلة**: تعارض بين إصدارات Java

```bash
# تحقق من إصدار Java الحالي
java -version

# يجب أن يكون Java 17 أو 21 (حسب Gradle)
```

**في Android Studio**:
1. `File` → `Project Structure` → `SDK Location`
2. تأكد من أن `JDK location` يشير إلى Java 17 أو 21
3. إذا لم يكن موجوداً، حمّله من: `Download JDK`

#### 4️⃣ تحديث Gradle وKotlin

**في `android/build.gradle`**:
```gradle
buildscript {
    dependencies {
        classpath 'com.android.tools.build:gradle:8.7.2'
        // تأكد من أن الإصدار محدّث
    }
}
```

**في `android/gradle/wrapper/gradle-wrapper.properties`**:
```properties
# تأكد من إصدار Gradle
distributionUrl=https\://services.gradle.org/distributions/gradle-8.9-all.zip
```

#### 5️⃣ زيادة Heap Memory لـ Gradle

**في `android/gradle.properties`**:
```properties
# زيادة الذاكرة المخصصة
org.gradle.jvmargs=-Xmx4096m -XX:MaxPermSize=1024m -XX:+HeapDumpOnOutOfMemoryError
org.gradle.daemon=true
org.gradle.parallel=true
org.gradle.configureondemand=true
```

#### 6️⃣ الحل النهائي: إعادة بناء كاملة

```bash
# 1. احذف كل شيء
cd android
rm -rf .gradle build app/build .idea

# 2. عد للمجلد الرئيسي
cd ..

# 3. تنظيف Node modules (اختياري)
rm -rf node_modules
npm install

# 4. بناء الويب
npm run build

# 5. مزامنة مع Android
npx cap sync android

# 6. فتح Android Studio
npx cap open android
```

**في Android Studio**:
1. `Build` → `Clean Project`
2. انتظر حتى ينتهي
3. `Build` → `Rebuild Project`
4. انتظر حتى ينتهي
5. `Build` → `Build APK(s)`

#### 7️⃣ إعادة تشغيل كل شيء

**الخطوات**:
1. أغلق Android Studio **تماماً**
2. أعد تشغيل الكمبيوتر (مهم!)
3. افتح Android Studio
4. `File` → `Sync Project with Gradle Files`
5. `Build` → `Rebuild Project`

---

### ⚠️ إذا ظهرت أخطاء أخرى في Build

#### خطأ: "SDK location not found"
```bash
# أنشئ ملف local.properties في android/
# أضف فيه:
sdk.dir=/path/to/your/Android/sdk

# على Mac:
sdk.dir=/Users/USERNAME/Library/Android/sdk

# على Windows:
sdk.dir=C\:\\Users\\USERNAME\\AppData\\Local\\Android\\Sdk

# على Linux:
sdk.dir=/home/USERNAME/Android/Sdk
```

#### خطأ: "Unsupported Java version"
- تأكد من Java 17 أو 21
- في Android Studio: `File` → `Settings` → `Build, Execution, Deployment` → `Build Tools` → `Gradle` → اختر JDK المناسب

---

## 📱 مشاكل التثبيت (Installation Errors)

### 🔧 حل مشكلة "App not installed"

## 📋 المشكلة
عند محاولة تثبيت التطبيق، تظهر رسالة:
```
request-mastermind
App not installed.
```

---

## ✅ الحلول المجربة (بالترتيب)

### 1️⃣ إلغاء تثبيت النسخة القديمة تماماً
**السبب**: تعارض في التوقيع الرقمي بين النسخ

**الخطوات**:
```bash
# على جهازك (Mac/Linux/Windows)
adb uninstall app.lovable.c9213afe1e6545938c572cfda087384c

# أو من الهاتف مباشرة
# Settings → Apps → request-mastermind → Uninstall
```

**ثم أعد تثبيت التطبيق الجديد**

---

### 2️⃣ حذف بيانات التطبيق القديم
**قبل إلغاء التثبيت**:
```
Settings → Apps → request-mastermind 
→ Storage → Clear Data + Clear Cache
→ ثم Uninstall
```

---

### 3️⃣ إعادة بناء التطبيق بتوقيع جديد

**في Android Studio**:
1. افتح `Build` → `Clean Project`
2. `Build` → `Rebuild Project`
3. `Build` → `Generate Signed Bundle / APK`
4. اختر نفس keystore القديم (أو أنشئ جديد)

**⚠️ مهم**: احفظ معلومات keystore (اسم الملف، كلمة المرور، alias)

---

### 4️⃣ التحقق من Package Name

**تأكد من أن Package Name لم يتغير**:

في ملف `android/app/build.gradle`:
```gradle
defaultConfig {
    applicationId "app.lovable.c9213afe1e6545938c572cfda087384c"
    // يجب أن يبقى نفس الاسم في كل النسخ
}
```

---

### 5️⃣ التحقق من minSdkVersion

**تأكد من أن إصدار Android مدعوم**:

في ملف `android/app/build.gradle`:
```gradle
minSdkVersion = 24  // Android 7.0+
```

**تحقق من إصدار هاتفك**:
```
Settings → About Phone → Android Version
```
يجب أن يكون **7.0 أو أحدث**

---

### 6️⃣ بناء APK جديد تماماً

**خطوات كاملة من البداية**:

```bash
# 1. في مجلد المشروع
git pull

# 2. تحديث الإصدار
./bump-patch.sh  # أو bump-patch.bat على Windows

# 3. تثبيت المكتبات
npm install

# 4. بناء الويب
npm run build

# 5. مزامنة مع Android
npx cap sync android

# 6. فتح Android Studio
npx cap open android
```

**في Android Studio**:
1. `Build` → `Clean Project`
2. `Build` → `Rebuild Project`
3. `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
4. انتظر حتى تظهر: "APK(s) generated successfully"

---

### 7️⃣ تثبيت APK عبر ADB مباشرة

```bash
# ابحث عن ملف APK (عادة في):
# android/app/build/outputs/apk/debug/app-debug.apk

# ثبّته عبر ADB
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# علامة -r تعني "replace" (استبدال النسخة القديمة)
```

**إذا ظهر خطأ "INSTALL_FAILED_UPDATE_INCOMPATIBLE"**:
```bash
# احذف التطبيق أولاً
adb uninstall app.lovable.c9213afe1e6545938c572cfda087384c

# ثم ثبّت من جديد
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🔍 التحقق من حالة التطبيق

### فحص التطبيق المثبت:
```bash
# تحقق من التطبيقات المثبتة
adb shell pm list packages | grep mastermind

# إذا كان مثبتاً، ستظهر:
# package:app.lovable.c9213afe1e6545938c572cfda087384c
```

### فحص معلومات APK:
```bash
# معلومات الـ APK
aapt dump badging android/app/build/outputs/apk/debug/app-debug.apk | grep package

# يجب أن تظهر:
# package: name='app.lovable.c9213afe1e6545938c572cfda087384c' versionCode='29' versionName='1.3.4'
```

---

## 📱 الحل الأسرع (للتجربة الفورية)

**إذا كنت تريد تجربة سريعة**:

1. **احذف التطبيق القديم تماماً** من الهاتف
2. **أعد تشغيل الهاتف** (Restart)
3. **في Android Studio**:
   - Clean Project
   - Rebuild Project
   - Run على الهاتف مباشرة (زر ▶️)

---

## ⚠️ ملاحظات مهمة

### عن التوقيع الرقمي:
- **Debug APK**: موقّع تلقائياً بتوقيع debug (للتطوير فقط)
- **Release APK**: يحتاج keystore خاص بك (للنشر على Google Play)
- **لا يمكن** استبدال تطبيق موقّع بـ Release بآخر موقّع بـ Debug (والعكس)

### إذا كنت تطوّر التطبيق:
- استخدم دائماً **نفس الـ keystore** لكل النسخ
- احفظ ملف keystore في مكان آمن
- لا تشارك كلمات المرور

### للنشر على Google Play:
- استخدم Release build مع keystore خاص
- وقّع التطبيق بنفس keystore في كل تحديث

---

## 🆘 إذا لم يعمل أي حل

**جرّب هذه الطريقة الأخيرة**:

1. غيّر Package Name مؤقتاً لاختبار:
```gradle
// في android/app/build.gradle
applicationId "app.lovable.c9213afe1e6545938c572cfda087384c.test"
```

2. ابنِ وثبّت
3. إذا نجح التثبيت، المشكلة من تعارض التوقيع
4. عد إلى Package Name الأصلي واحذف النسخة القديمة كاملاً

---

## 📞 معلومات إضافية

**موقع ملف APK النهائي**:
```
android/app/build/outputs/apk/
├── debug/
│   └── app-debug.apk          ← للتطوير والتجربة
└── release/
    └── app-release.apk        ← للنشر النهائي
```

**سجلات الأخطاء**:
```bash
# لرؤية سبب فشل التثبيت
adb logcat | grep PackageInstaller
```

---

## ✅ الخلاصة

**90% من المشاكل تُحل بـ**:
1. حذف التطبيق القديم تماماً
2. إعادة تشغيل الهاتف
3. بناء APK جديد (Clean + Rebuild)
4. التثبيت مرة أخرى

**إذا استمرت المشكلة**:
- تأكد من أن Package Name لم يتغير
- استخدم نفس keystore دائماً
- تأكد من minSdkVersion مدعوم على هاتفك
