# دليل حالات الطلبات - نظام شامل

## 🔄 دورة حياة الطلب الكاملة

### المسار الأول: الإكمال الطبيعي ✅
```
┌─────────────────────────────────────────────────────────┐
│  1. pending        → طلب جديد (بانتظار محترف)          │
│  2. in-progress    → محترف بدأ بالتعامل مع الطلب         │
│  3. upcoming       → تم تأكيد موعد مع العميل            │
│  4. confirmed      → تم تأكيد الطلب ومحترف معين          │
│                                                          │
│  ===== مرحلة التتبع (Tracking) =====                    │
│  5. moving         → المحترف في الطريق للعميل          │
│  6. arrived        → المحترف وصل لموقع العميل           │
│  7. waiting        → انتظار العميل (له وقت محدد)       │
│  8. working        → بدأ العمل                          │
│  9. invoice_requested → طلب الفاتورة                   │
│  10. payment_received → استلام الدفع                   │
│                                                          │
│  11. completed     → اكتمل الطلب ✅                      │
└─────────────────────────────────────────────────────────┘
```

### المسار الثاني: الإلغاء ❌
```
┌──────────────────────────────────────────────┐
│  يمكن الإلغاء من أي مرحلة                   │
│  ↓                                           │
│  status: 'cancelled'                        │
│  tracking_stage: null (يجب تصفيره!)        │
│  cancelled_at: timestamp                    │
│  cancelled_by: user_id                      │
│  cancellation_reason: text                  │
└──────────────────────────────────────────────┘
```

### المسار الثالث: الطلبات العالقة 🔄
```
┌───────────────────────────────────────────────────┐
│  طلب في حالة الانتظار (waiting)                  │
│  ↓                                                │
│  إذا انتهى وقت الانتظار (waiting_ends_at)        │
│  ↓                                                │
│  يتم نقله إلى pending (للمراجعة)                 │
│  أو cancelled (حسب السياسة)                      │
└───────────────────────────────────────────────────┘
```

---

## ⚠️ الحالات المتناقضة (Inconsistent States)

### 1. 🔴 طلب ملغي لكن له tracking_stage
**المشكلة:**
```json
{
  "status": "cancelled",
  "tracking_stage": "working",  // ❌ يجب أن يكون null
  "cancelled_at": "2025-11-13T08:10:16.461Z"
}
```

**السبب:**
- تم إلغاء الطلب دون تصفير مرحلة التتبع
- يظهر الطلب في قسم "In Progress" بدلاً من "Cancelled"

**الحل التلقائي:**
```sql
UPDATE orders 
SET tracking_stage = NULL, updated_at = NOW()
WHERE status = 'cancelled' AND tracking_stage IS NOT NULL;
```

**الأولوية:** 🔴 عالية جداً (يؤثر على واجهة المستخدم مباشرة)

---

### 2. 🔴 طلب في مرحلة العمل لكن لديه أوقات انتظار
**المشكلة:**
```json
{
  "tracking_stage": "working",
  "waiting_started_at": "2025-11-13T08:00:00Z",  // ❌ يجب أن يكون null
  "waiting_ends_at": "2025-11-13T08:30:00Z"      // ❌ يجب أن يكون null
}
```

**السبب:**
- بدأ المحترف بالعمل لكن لم يتم تصفير أوقات الانتظار
- يسبب تضارب في البيانات والإحصائيات

**الحل التلقائي:**
```sql
UPDATE orders 
SET waiting_started_at = NULL, 
    waiting_ends_at = NULL,
    updated_at = NOW()
WHERE tracking_stage = 'working' 
AND (waiting_started_at IS NOT NULL OR waiting_ends_at IS NOT NULL);
```

**الأولوية:** 🔴 عالية جداً

---

### 3. 🟠 استلام الدفع لكن الطلب غير مكتمل
**المشكلة:**
```json
{
  "tracking_stage": "payment_received",
  "status": "in-progress"  // ❌ يجب أن يكون 'completed'
}
```

**السبب:**
- تم تسجيل استلام الدفع دون تحديث حالة الطلب
- الطلب يبدو غير مكتمل رغم أنه انتهى

**الحل التلقائي:**
```sql
UPDATE orders 
SET status = 'completed', updated_at = NOW()
WHERE tracking_stage = 'payment_received' 
AND status != 'completed';
```

**الأولوية:** 🟠 متوسطة

---

### 4. 🟠 طلب مكتمل لكن بدون تسجيل الدفع
**المشكلة:**
```json
{
  "status": "completed",
  "tracking_stage": "working"  // ❌ يجب أن يكون 'payment_received'
}
```

**السبب:**
- تم إكمال الطلب يدوياً دون المرور بمراحل التتبع
- قد يسبب مشاكل في التقارير المالية

**الحل التلقائي:**
```sql
UPDATE orders 
SET tracking_stage = 'payment_received', updated_at = NOW()
WHERE status = 'completed' 
AND tracking_stage != 'payment_received';
```

**الأولوية:** 🟠 متوسطة

---

### 5. 🟠 طلب pending لكن له tracking_stage
**المشكلة:**
```json
{
  "status": "pending",
  "tracking_stage": "moving"  // ❌ يجب أن يكون null
}
```

**السبب:**
- خطأ في تسلسل التحديثات
- طلب تم إرجاعه لـ pending دون تصفير التتبع

**الحل التلقائي:**
```sql
UPDATE orders 
SET tracking_stage = NULL, updated_at = NOW()
WHERE status = 'pending' 
AND tracking_stage IS NOT NULL;
```

**الأولوية:** 🟠 متوسطة

---

### 6. 🟡 انتظار بدون أوقات صحيحة
**المشكلة:**
```json
{
  "tracking_stage": "waiting",
  "waiting_started_at": null,   // ❌ يجب أن يكون timestamp
  "waiting_ends_at": null        // ❌ يجب أن يكون timestamp
}
```

**السبب:**
- تم تغيير المرحلة إلى waiting دون تسجيل الأوقات
- لا يمكن معرفة متى بدأ أو متى ينتهي الانتظار

**الحل التلقائي:**
```sql
UPDATE orders 
SET tracking_stage = 'arrived',
    waiting_started_at = NULL,
    waiting_ends_at = NULL,
    updated_at = NOW()
WHERE tracking_stage = 'waiting' 
AND (waiting_started_at IS NULL OR waiting_ends_at IS NULL);
```

**الأولوية:** 🟡 منخفضة (حالات نادرة)

---

### 7. 🔴 طلب عالق في الانتظار (تجاوز الوقت)
**المشكلة:**
```json
{
  "tracking_stage": "waiting",
  "waiting_ends_at": "2025-11-13T08:00:00Z",  // انتهى الوقت منذ ساعات
  "current_time": "2025-11-13T12:00:00Z"
}
```

**السبب:**
- انتهى وقت انتظار العميل ولم يحضر
- لم يتم تحديث الطلب تلقائياً

**الحل التلقائي:**
```sql
UPDATE orders 
SET status = 'pending',
    tracking_stage = NULL,
    waiting_started_at = NULL,
    waiting_ends_at = NULL,
    updated_at = NOW()
WHERE tracking_stage = 'waiting' 
AND waiting_ends_at < NOW();
```

**ملاحظة:** يمكن أيضاً نقله إلى `cancelled` حسب سياسة الشركة

**الأولوية:** 🔴 عالية

---

### 8. 🟡 tracking بدون محترف مقبول
**المشكلة:**
```json
{
  "tracking_stage": "working",
  "order_specialists": [
    { "is_accepted": false },
    { "is_accepted": null }
  ]
  // لا يوجد محترف مع is_accepted = true
}
```

**السبب:**
- تم بدء التتبع دون وجود محترف مقبول
- أو تم رفض/حذف المحترف بعد بدء التتبع

**الحل التلقائي:**
```sql
-- يتطلب query معقد للتحقق من order_specialists
UPDATE orders o
SET tracking_stage = NULL,
    status = 'pending',
    updated_at = NOW()
WHERE o.tracking_stage IN ('moving', 'arrived', 'working')
AND NOT EXISTS (
  SELECT 1 FROM order_specialists os
  WHERE os.order_id = o.id AND os.is_accepted = true
);
```

**الأولوية:** 🟡 منخفضة (نادرة جداً)

---

## 🔧 نظام الإصلاح التلقائي

### تشغيل Cron Job كل 5 دقائق
```sql
SELECT cron.schedule(
  'fix-inconsistent-orders',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/fix-inconsistent-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_ANON_KEY'
    )
  );
  $$
);
```

### Edge Function: fix-inconsistent-orders
يقوم بـ:
1. فحص جميع الحالات المتناقضة
2. إصلاح الأولويات العالية أولاً
3. تسجيل جميع الإصلاحات في logs
4. إرسال تقرير بالنتائج

### الوصول لصفحة التشخيص
```
/orders-diagnostics
```

**المميزات:**
- عرض جميع المشاكل المكتشفة
- تصنيف حسب الأولوية
- زر "إصلاح الكل" بضغطة واحدة
- سجل كامل للإصلاحات

---

## 📊 إحصائيات الحالات

### الفلترة في واجهة الإدارة

**New Requests (pending)**
```javascript
status === 'pending' && !tracking_stage
```

**Awaiting Response (in-progress)**
```javascript
status === 'in-progress' && !tracking_stage
```

**Upcoming/Confirmed**
```javascript
(status === 'upcoming' || has_accepted_quote) && !tracking_stage
```

**In Progress**
```javascript
tracking_stage IN ('moving', 'arrived', 'working', 'invoice_requested')
&& status !== 'cancelled'  // ⭐ مهم جداً!
```

**Completed**
```javascript
tracking_stage === 'payment_received' || status === 'completed'
```

**Cancelled**
```javascript
status === 'cancelled'
&& tracking_stage === null  // يجب أن يكون null دائماً
```

---

## 🛡️ الوقاية من الحالات المتناقضة

### 1. استخدام Database Triggers
```sql
-- Trigger لتصفير tracking_stage عند الإلغاء
CREATE OR REPLACE FUNCTION clear_tracking_on_cancel()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' THEN
    NEW.tracking_stage := NULL;
    NEW.waiting_started_at := NULL;
    NEW.waiting_ends_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_clear_tracking_on_cancel
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION clear_tracking_on_cancel();
```

### 2. استخدام Database Constraints
```sql
-- منع tracking_stage مع status = cancelled
ALTER TABLE orders ADD CONSTRAINT check_no_tracking_when_cancelled
  CHECK (
    (status = 'cancelled' AND tracking_stage IS NULL) OR
    status != 'cancelled'
  );

-- منع waiting times مع tracking_stage = working
ALTER TABLE orders ADD CONSTRAINT check_no_waiting_when_working
  CHECK (
    (tracking_stage = 'working' AND waiting_started_at IS NULL AND waiting_ends_at IS NULL) OR
    tracking_stage != 'working'
  );
```

### 3. التحقق في الكود (Application Level)
```typescript
// قبل تحديث status إلى cancelled
await supabase
  .from('orders')
  .update({
    status: 'cancelled',
    tracking_stage: null,  // ⭐ دائماً صفّر tracking_stage
    waiting_started_at: null,
    waiting_ends_at: null,
    cancelled_at: new Date().toISOString(),
    cancelled_by: userId
  })
  .eq('id', orderId);
```

---

## 📈 مراقبة الجودة

### مؤشرات الأداء (KPIs)
1. **عدد الحالات المتناقضة المكتشفة يومياً**
   - الهدف: < 5 حالات/يوم

2. **وقت الإصلاح التلقائي**
   - الهدف: < 5 دقائق

3. **معدل تكرار نفس المشكلة**
   - الهدف: 0% (لا تتكرر بعد الإصلاح)

### التنبيهات (Alerts)
```typescript
// إرسال تنبيه إذا تم اكتشاف أكثر من 10 حالات متناقضة
if (totalInconsistencies > 10) {
  await sendAdminAlert({
    type: 'critical',
    message: `Found ${totalInconsistencies} inconsistent orders`,
    action: 'Review logs and check for system issues'
  });
}
```

---

## 🎯 الخلاصة

### قواعد ذهبية:
1. ✅ **cancelled** = `tracking_stage: null` (دائماً!)
2. ✅ **working** = `waiting_started_at: null, waiting_ends_at: null`
3. ✅ **completed** = `tracking_stage: 'payment_received'`
4. ✅ **payment_received** = `status: 'completed'`
5. ✅ **pending** = `tracking_stage: null`
6. ✅ **waiting** = `waiting_started_at & waiting_ends_at` (كلاهما موجود)

### نظام الإصلاح:
- 🔄 فحص تلقائي كل 5 دقائق
- 🎯 أولويات واضحة للإصلاح
- 📊 صفحة تشخيص شاملة
- 🛡️ وقاية من التكرار عبر triggers

---

**آخر تحديث:** 2025-11-13
**النسخة:** 1.0
