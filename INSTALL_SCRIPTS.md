# 🔧 تثبيت نظام الإصدارات التلقائي

## ⚠️ خطوة إضافية مطلوبة

بما أن ملف `package.json` محمي، تحتاج لإضافة الأوامر يدوياً.

---

## 📝 الخطوات

### 1️⃣ صدّر المشروع إلى GitHub
اضغط على زر **"Export to Github"** في أعلى Lovable

### 2️⃣ اسحب المشروع على جهازك
```bash
git pull
```

### 3️⃣ افتح ملف `package.json`
ابحث عن قسم `"scripts"` وأضف الأسطر التالية:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:dev": "vite build --mode development",
    "lint": "eslint .",
    "preview": "vite preview",
    
    // أضف هذه الأسطر الأربعة 👇
    "bump:patch": "node scripts/bump-version.js patch",
    "bump:minor": "node scripts/bump-version.js minor",
    "bump:major": "node scripts/bump-version.js major",
    "version:check": "cat version.json"
  }
}
```

### 4️⃣ احفظ الملف

### 5️⃣ ارفع التغييرات
```bash
git add package.json
git commit -m "Add version bump scripts"
git push
```

---

## ✅ تأكد من التثبيت

جرّب الأمر:
```bash
npm run version:check
```

يجب أن ترى:
```json
{
  "versionCode": 29,
  "versionName": "1.3.4"
}
```

---

## 🎯 جاهز للاستخدام!

الآن يمكنك استخدام:
- `npm run bump:patch` - للتحديثات الصغيرة
- `npm run bump:minor` - للميزات الجديدة
- `npm run bump:major` - للتحديثات الكبيرة
- `npm run version:check` - للتحقق من الإصدار

---

## 📚 المزيد من المعلومات

راجع ملف `VERSION_GUIDE_AR.md` للدليل الكامل بالعربية!
