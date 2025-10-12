# 🔥 إعداد Firebase Push Notifications

تم تثبيت نظام Firebase Cloud Messaging لإرسال إشعارات قوية للمحترفات حتى لو التطبيق مغلق!

## 📋 خطوات الإعداد النهائية:

### 1️⃣ إنشاء مشروع Firebase (5 دقائق)

1. اذهب إلى [Firebase Console](https://console.firebase.google.com/)
2. اضغط "Add project" أو "إضافة مشروع"
3. أدخل اسم المشروع (مثلاً: request-mastermind)
4. اضغط Continue واتبع الخطوات

### 2️⃣ إضافة تطبيق Android

1. في Firebase Console، اختر مشروعك
2. اضغط على أيقونة Android لإضافة تطبيق
3. أدخل Package Name: `app.lovable.c9213afe1e6545938c572cfda087384c`
4. (اختياري) أدخل اسم التطبيق: Request Mastermind
5. اضغط "Register app"
6. **مهم جداً**: حمّل ملف `google-services.json`
7. ضع الملف في المسار: `android/app/google-services.json`

### 3️⃣ الحصول على Server Key

1. في Firebase Console، اذهب إلى Project Settings (⚙️)
2. اختر تبويب "Cloud Messaging"
3. في قسم "Cloud Messaging API (Legacy)"
4. انسخ "Server key"
5. الصق القيمة في Secret الذي طلبته منك (FIREBASE_SERVER_KEY)

### 4️⃣ تحديث Firebase Config في الكود

افتح ملف `src/lib/firebaseConfig.ts` واستبدل القيم بقيم مشروعك من Firebase Console > Project Settings > General:

```typescript
export const firebaseConfig = {
  apiKey: "AIzaSy...",  // من Firebase Console
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456:android:abc..."
};
```

### 5️⃣ تحديث build.gradle (Android)

أضف Firebase إلى ملف `android/app/build.gradle`:

```gradle
dependencies {
    implementation 'com.google.firebase:firebase-messaging:23.4.0'
    // ... باقي dependencies
}
```

وفي ملف `android/build.gradle` أضف:

```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.4.0'
    }
}
```

وفي نهاية `android/app/build.gradle` أضف:

```gradle
apply plugin: 'com.google.gms.google-services'
```

### 6️⃣ تشغيل التطبيق

```bash
git pull
npm install
npm run build
npx cap sync android
npx cap run android
```

## ✅ ماذا تم تنفيذه تلقائياً؟

- ✅ جدول `device_tokens` لحفظ رموز الأجهزة
- ✅ Edge Function `send-push-notification` لإرسال الإشعارات
- ✅ نظام تسجيل Device Tokens تلقائياً عند فتح التطبيق
- ✅ إرسال إشعارات عند إنشاء طلب جديد
- ✅ إرسال إشعارات عند إعادة إرسال الطلب
- ✅ حذف Tokens غير الصالحة تلقائياً

## 🎯 المميزات:

- 🔔 **إشعارات حقيقية**: تعمل حتى لو التطبيق مغلق تماماً
- 🔊 **صوت قوي**: رنين مستمر مثل المكالمات
- 📱 **فتح التطبيق**: النقر على الإشعار يفتح التطبيق مباشرة
- ⚡ **سريع**: يصل الإشعار فوراً بدون تأخير
- 🎯 **موثوق**: نظام Firebase المستخدم من WhatsApp وغيره

## 🔧 اختبار النظام:

1. سجل دخول كمحترفة في التطبيق
2. من لوحة الإدارة، أنشئ طلب جديد
3. يجب أن يصل إشعار فوري للمحترفة مع صوت قوي!

## ❓ استكشاف الأخطاء:

إذا لم تعمل الإشعارات:
1. تأكد من إضافة `google-services.json` في المكان الصحيح
2. تأكد من إضافة Firebase Server Key في Secrets
3. تأكد من تشغيل `npx cap sync android`
4. تحقق من Console Logs في التطبيق
5. تحقق من Edge Function Logs للتأكد من إرسال الإشعارات

## 📚 موارد إضافية:

- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging)
- [Capacitor Push Notifications](https://capacitorjs.com/docs/apis/push-notifications)
