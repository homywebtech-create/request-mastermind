# دليل الحالات المتناقضة للطلبات

## دورة حياة الطلب الطبيعية

### المسار الأول: من البداية للإكمال
```
pending → in-progress/upcoming → confirmed → 
tracking: moving → arrived → working → invoice_requested → payment_received → 
status: completed
```

### المسار الثاني: الإلغاء
```
يمكن الإلغاء من أي مرحلة → status: cancelled + tracking_stage: null
```

### المسار الثالث: حالة الانتظار (عالق)
```
tracking: moving/arrived → waiting (waiting_started_at + waiting_ends_at) →
إما: working (إذا بدأ العميل)
أو: pending (إذا تأخر العميل - نظام الإصلاح التلقائي)
أو: cancelled (إذا انتهى وقت الانتظار)
```

---

## الحالات المتناقضة وكيفية إصلاحها

### 1. طلب ملغي لكن له tracking_stage
**المشكلة:**
- `status = 'cancelled'` 
- `tracking_stage != null`

**السبب:** تم إلغاء الطلب دون تصفير مرحلة التتبع

**الحل:** `tracking_stage = null`

---

### 2. طلب في مرحلة العمل لكن لديه أوقات انتظار
**المشكلة:**
- `tracking_stage = 'working'`
- `waiting_started_at != null` OR `waiting_ends_at != null`

**السبب:** بدأ العمل دون تصفير أوقات الانتظار

**الحل:** 
```sql
waiting_started_at = null
waiting_ends_at = null
```

---

### 3. طلب في مرحلة انتظار لكن بدون أوقات
**المشكلة:**
- `tracking_stage = 'waiting'`
- `waiting_started_at IS NULL` OR `waiting_ends_at IS NULL`

**السبب:** تم تغيير المرحلة دون تسجيل الأوقات

**الحل:** إعادة للمرحلة السابقة أو إلى `pending`

---

### 4. استلام الدفع لكن الطلب غير مكتمل
**المشكلة:**
- `tracking_stage = 'payment_received'`
- `status != 'completed'`

**السبب:** تم تسجيل الدفع دون إكمال الطلب

**الحل:** `status = 'completed'`

---

### 5. طلب مكتمل لكن بدون تسجيل الدفع
**المشكلة:**
- `status = 'completed'`
- `tracking_stage != 'payment_received'`

**السبب:** تم إكمال الطلب يدوياً دون المرور بالمراحل

**الحل:** `tracking_stage = 'payment_received'`

---

### 6. طلب له tracking لكن status = pending
**المشكلة:**
- `status = 'pending'`
- `tracking_stage != null`

**السبب:** خطأ في تسلسل التحديثات

**الحل:** `tracking_stage = null` أو تصحيح status

---

### 7. طلب عالق في الانتظار (تجاوز الوقت)
**المشكلة:**
- `tracking_stage = 'waiting'`
- `waiting_ends_at < NOW()`

**السبب:** انتهى وقت الانتظار ولم يتم التحديث

**الحل:** إعادة إلى `pending` لإعادة المحاولة أو `cancelled` حسب السياسة

---

### 8. طلب له tracking لكن بدون محترف مقبول
**المشكلة:**
- `tracking_stage IN ('moving', 'arrived', 'working')`
- لا يوجد `order_specialists` مع `is_accepted = true`

**السبب:** تم حذف أو رفض المحترف بعد بدء التتبع

**الحل:** `tracking_stage = null`, `status = 'pending'`

---

## أولويات الإصلاح

### أولوية عالية (تؤثر على واجهة المستخدم)
1. طلب ملغي مع tracking_stage
2. طلب في العمل مع أوقات انتظار

### أولوية متوسطة (بيانات غير دقيقة)
3. استلام دفع بدون إكمال
4. إكمال بدون تسجيل دفع
5. pending مع tracking

### أولوية منخفضة (حالات نادرة)
6. انتظار بدون أوقات
7. طلب عالق (يُعالج بنظام منفصل)
8. tracking بدون محترف

---

## استراتيجية الإصلاح التلقائي

1. **فحص كل 5 دقائق** عبر cron job
2. **إصلاح فوري** للأولويات العالية
3. **تسجيل** جميع الإصلاحات في logs
4. **إشعار المسؤول** عند اكتشاف حالات متكررة
