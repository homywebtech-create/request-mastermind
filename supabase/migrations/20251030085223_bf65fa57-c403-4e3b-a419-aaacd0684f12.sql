-- تنظيف النظام من جميع الطلبات السابقة والبيانات المرتبطة

-- حذف التقييمات
DELETE FROM specialist_reviews;

-- حذف جداول المحترفات
DELETE FROM specialist_schedules;

-- حذف العروض والاقتباسات
DELETE FROM order_specialists;

-- حذف الطلبات
DELETE FROM orders;

-- حذف العملاء
DELETE FROM customers;

-- حذف سجلات النشاط المتعلقة بالطلبات
DELETE FROM activity_logs WHERE resource_type IN ('order', 'customer');

-- إعادة تعيين عداد أرقام الطلبات (اختياري - لبدء من ORD-0001 مرة أخرى)
-- هذا سيتم تلقائياً في الطلب التالي