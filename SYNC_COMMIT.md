# 🔄 دليل المزامنة والرفع (Sync & Commit)

## 📝 الخطوات الكاملة لرفع نسخة جديدة

### 1️⃣ تحديث رقم الإصدار

**على Mac/Linux**:
```bash
./bump-patch.sh    # لتحديثات صغيرة (1.3.4 → 1.3.5)
./bump-minor.sh    # لميزات جديدة (1.3.4 → 1.4.0)
./bump-major.sh    # لتغييرات كبيرة (1.3.4 → 2.0.0)
```

**على Windows**:
```bash
bump-patch.bat
bump-minor.bat
bump-major.bat
```

---

### 2️⃣ التحقق من التحديث

```bash
./check-version.sh    # Mac/Linux
check-version.bat     # Windows

# سيظهر:
# ✅ Version Code: 30
# ✅ Version Name: 1.3.5
# ✅ Last Updated: 2025-01-08
```

---

### 3️⃣ حفظ التغييرات في Git

```bash
# إضافة كل الملفات المعدلة
git add .

# حفظ التغيير مع رسالة واضحة
git commit -m "Bump version to 1.3.5"

# رفع إلى GitHub
git push origin main
```

---

### 4️⃣ المزامنة مع Android

```bash
# مزامنة الملفات
npx cap sync android

# فتح Android Studio
npx cap open android
```

---

### 5️⃣ البناء في Android Studio

1. انتظر حتى ينتهي Gradle من التحميل
2. `Build` → `Clean Project`
3. `Build` → `Rebuild Project`
4. `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
5. انتظر رسالة: **"APK(s) generated successfully"**

---

## 🚀 سير العمل الموصى به

### للتحديثات اليومية:
```bash
# 1. اسحب آخر التحديثات
git pull

# 2. عدّل الكود كما تريد
# ... تعديلاتك هنا ...

# 3. زد رقم الإصدار
./bump-patch.sh

# 4. احفظ وارفع
git add .
git commit -m "Fix: حل مشكلة كذا"
git push

# 5. زامن وابنِ
npx cap sync android
npx cap open android
```

---

### للميزات الجديدة:
```bash
# استخدم bump-minor
./bump-minor.sh

git add .
git commit -m "Feature: إضافة ميزة كذا"
git push

npx cap sync android
```

---

### للإصدارات الكبرى:
```bash
# استخدم bump-major
./bump-major.sh

git add .
git commit -m "Release: الإصدار 2.0.0 - تغييرات كبيرة"
git push

npx cap sync android
```

---

## 📦 أين يوجد ملف APK؟

بعد البناء في Android Studio:

```
android/app/build/outputs/apk/
├── debug/
│   └── app-debug.apk          ← هنا
└── release/
    └── app-release.apk
```

---

## 🔍 فحص معلومات APK

```bash
# رؤية معلومات الـ APK
aapt dump badging android/app/build/outputs/apk/debug/app-debug.apk | grep version

# سيظهر:
# versionCode='30' versionName='1.3.5'
```

---

## ⚠️ ملاحظات مهمة

### 1. الترتيب مهم جداً:
```
تحديث الإصدار → Commit → Push → Sync → Build
```

### 2. لا تنسَ:
- ✅ `git add .` قبل `git commit`
- ✅ `npx cap sync` قبل فتح Android Studio
- ✅ Clean Project قبل Build

### 3. تحقق من النسخة:
```bash
# قبل البناء
./check-version.sh

# بعد البناء
aapt dump badging android/app/build/outputs/apk/debug/app-debug.apk | grep versionCode
```

---

## 🐛 حل المشاكل الشائعة

### "changes not synced"
```bash
npx cap sync android --force
```

### "build failed"
```bash
cd android
./gradlew clean
cd ..
npx cap sync android
```

### "version mismatch"
```bash
# تحقق من
cat version.json
cat android/app/build.gradle | grep versionCode
cat android/app/build.gradle | grep versionName

# يجب أن تكون جميعها متطابقة
```

---

## 📚 الملفات المتأثرة بالتحديث

عند تشغيل `bump-patch.sh`:
```
✓ version.json           ← يُحدَّث تلقائياً
✓ android/app/build.gradle  ← يُحدَّث تلقائياً
✓ README.md (اختياري)
```

---

## ✅ Checklist قبل الرفع

- [ ] تحديث رقم الإصدار (`./bump-patch.sh`)
- [ ] التحقق من النسخة (`./check-version.sh`)
- [ ] حفظ في Git (`git add . && git commit`)
- [ ] رفع إلى GitHub (`git push`)
- [ ] مزامنة (`npx cap sync android`)
- [ ] بناء في Android Studio
- [ ] اختبار APK على الهاتف
- [ ] تحميل APK إلى نظام التوزيع
