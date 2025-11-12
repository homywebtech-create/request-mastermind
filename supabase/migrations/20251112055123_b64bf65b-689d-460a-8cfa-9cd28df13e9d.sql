-- Create table for WhatsApp message templates
CREATE TABLE public.whatsapp_message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_key TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  description_en TEXT NOT NULL,
  template_ar TEXT NOT NULL,
  template_en TEXT NOT NULL,
  category TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_message_templates ENABLE ROW LEVEL SECURITY;

-- Admins can manage templates
CREATE POLICY "Admins can manage whatsapp templates"
ON public.whatsapp_message_templates
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Anyone can read templates (for sending messages)
CREATE POLICY "Anyone can read whatsapp templates"
ON public.whatsapp_message_templates
FOR SELECT
USING (is_active = true);

-- Create function to update timestamps
CREATE TRIGGER update_whatsapp_message_templates_updated_at
BEFORE UPDATE ON public.whatsapp_message_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default message templates
INSERT INTO public.whatsapp_message_templates (message_key, name_ar, name_en, description_ar, description_en, template_ar, template_en, category) VALUES
('order_created', 'رسالة إنشاء الطلب', 'Order Created', 'تُرسل للعميل عند إنشاء طلب جديد', 'Sent to customer when a new order is created', 'مرحباً {{customer_name}} 👋

تم استلام طلبك بنجاح!

📋 رقم الطلب: {{order_number}}
🔧 نوع الخدمة: {{service_type}}
📅 تاريخ الحجز: {{booking_date}}

نحن الآن نبحث عن أفضل المحترفين لخدمتك. سنرسل لك العروض المتاحة قريباً.

شكراً لثقتك بنا 🌟', 'Hello {{customer_name}} 👋

Your order has been received successfully!

📋 Order Number: {{order_number}}
🔧 Service Type: {{service_type}}
📅 Booking Date: {{booking_date}}

We are now looking for the best professionals to serve you. We will send you available offers soon.

Thank you for trusting us 🌟', 'customer'),

('specialist_offers', 'رسالة العروض', 'Specialist Offers', 'تُرسل للعميل بعد استجابة المحترفين للطلب', 'Sent to customer after specialists respond to the order', 'مرحباً {{customer_name}} 👋

لديك عروض جديدة من محترفين لطلبك رقم: {{order_number}}

{{offers_list}}

الرجاء مراجعة العروض واختيار المحترف المناسب.', 'Hello {{customer_name}} 👋

You have new offers from professionals for your order number: {{order_number}}

{{offers_list}}

Please review the offers and choose the suitable professional.', 'customer'),

('booking_confirmed', 'رسالة تأكيد الحجز', 'Booking Confirmed', 'تُرسل للعميل بعد تأكيد الحجز', 'Sent to customer after booking confirmation', 'مرحباً {{customer_name}} 👋

تم تأكيد حجزك بنجاح! ✅

📋 رقم الطلب: {{order_number}}
👤 المحترف: {{specialist_name}}
📅 التاريخ: {{booking_date}}
⏰ الوقت: {{booking_time}}
💰 المبلغ المتفق عليه: {{agreed_amount}} ريال

سيصلك تذكير قبل الموعد بساعة.

نتمنى لك تجربة ممتازة 🌟', 'Hello {{customer_name}} 👋

Your booking has been confirmed successfully! ✅

📋 Order Number: {{order_number}}
👤 Professional: {{specialist_name}}
📅 Date: {{booking_date}}
⏰ Time: {{booking_time}}
💰 Agreed Amount: {{agreed_amount}} SAR

You will receive a reminder one hour before the appointment.

We wish you an excellent experience 🌟', 'customer'),

('booking_reminder', 'رسالة التذكير قبل ساعة', 'One Hour Reminder', 'تُرسل للعميل قبل الموعد بساعة', 'Sent to customer one hour before appointment', 'مرحباً {{customer_name}} 👋

تذكير بموعدك القادم! ⏰

📋 رقم الطلب: {{order_number}}
👤 المحترف: {{specialist_name}}
⏰ بعد ساعة واحدة
🕐 الوقت: {{booking_time}}

المحترف سيكون معك في الوقت المحدد بإذن الله.

استعد لاستقبال المحترف 🎯', 'Hello {{customer_name}} 👋

Reminder for your upcoming appointment! ⏰

📋 Order Number: {{order_number}}
👤 Professional: {{specialist_name}}
⏰ In one hour
🕐 Time: {{booking_time}}

The professional will be with you at the scheduled time, God willing.

Get ready to receive the professional 🎯', 'customer'),

('specialist_arrived', 'رسالة الوصول', 'Arrival Message', 'تُرسل عندما يضغط المحترف على زر الوصول', 'Sent when specialist clicks arrival button', 'مرحباً {{customer_name}} 👋

نود إعلامك أن المحترف {{specialist_name}} قد وصل إلى موقعك.

نرجو منك استقباله لبدء تقديم الخدمة.

شكراً لتعاونك 🙏', 'Hello {{customer_name}} 👋

We would like to inform you that the professional {{specialist_name}} has arrived at your location.

Please receive them to start providing the service.

Thank you for your cooperation 🙏', 'customer'),

('waiting_for_customer', 'رسالة الانتظار', 'Waiting Message', 'تُرسل عندما يختار المحترف أن العميل لم يستقبله', 'Sent when specialist indicates customer is not present', 'مرحباً {{customer_name}} 👋

⏰ المحترف {{specialist_name}} في انتظار استقبالك حالياً.

⚠️ نرجو منك استقباله خلال 15 دقيقة.

في حالة عدم الاستقبال، سيتم:
• احتساب رسوم الانتظار
• إلغاء الطلب تلقائياً

نقدر تفهمك وتعاونك 🙏', 'Hello {{customer_name}} 👋

⏰ The professional {{specialist_name}} is currently waiting for you to receive them.

⚠️ Please receive them within 15 minutes.

If not received:
• Waiting fees will be charged
• Order will be automatically cancelled

We appreciate your understanding and cooperation 🙏', 'customer'),

('work_started', 'رسالة بدء العمل', 'Work Started', 'تُرسل عندما يبدأ المحترف العمل', 'Sent when specialist starts work', 'مرحباً {{customer_name}} 👋

بدأ المحترف {{specialist_name}} العمل الآن! 🚀

📋 رقم الطلب: {{order_number}}
⏰ وقت البداية: {{start_time}}

نتمنى لك تجربة ممتازة 🌟', 'Hello {{customer_name}} 👋

Professional {{specialist_name}} has started work now! 🚀

📋 Order Number: {{order_number}}
⏰ Start Time: {{start_time}}

We wish you an excellent experience 🌟', 'customer'),

('work_completed', 'رسالة إنهاء العمل', 'Work Completed', 'تُرسل عند إنهاء العمل مع الفاتورة', 'Sent when work is completed with invoice', 'مرحباً {{customer_name}} 👋

تم إنهاء الخدمة بنجاح! ✅

📋 رقم الطلب: {{order_number}}
👤 المحترف: {{specialist_name}}
⏰ مدة العمل: {{work_duration}} ساعة
💰 قيمة الفاتورة: {{total_amount}} ريال

نتمنى أن تكون راضياً عن الخدمة.

شكراً لثقتك بنا 🌟', 'Hello {{customer_name}} 👋

Service completed successfully! ✅

📋 Order Number: {{order_number}}
👤 Professional: {{specialist_name}}
⏰ Work Duration: {{work_duration}} hours
💰 Invoice Amount: {{total_amount}} SAR

We hope you are satisfied with the service.

Thank you for trusting us 🌟', 'customer'),

('work_extended', 'رسالة التمديد', 'Extension Message', 'تُرسل عند تمديد وقت العمل', 'Sent when work time is extended', 'مرحباً {{customer_name}} 👋

تم تمديد وقت العمل! ⏰

📋 رقم الطلب: {{order_number}}
⏱️ مدة التمديد: {{extension_duration}} ساعة
💰 تكلفة التمديد: {{extension_cost}} ريال

سيتم إضافة هذا المبلغ للفاتورة النهائية.

شكراً لتعاونك 🙏', 'Hello {{customer_name}} 👋

Work time has been extended! ⏰

📋 Order Number: {{order_number}}
⏱️ Extension Duration: {{extension_duration}} hours
💰 Extension Cost: {{extension_cost}} SAR

This amount will be added to the final invoice.

Thank you for your cooperation 🙏', 'customer'),

('request_review', 'رسالة طلب التقييم', 'Review Request', 'تُرسل للعميل لطلب تقييم الخدمة', 'Sent to customer to request service review', 'مرحباً {{customer_name}} 👋

نتمنى أن تكون راضياً عن الخدمة! 🌟

نود معرفة رأيك في:
• جودة الخدمة
• المحترف {{specialist_name}}
• تجربتك بشكل عام

تقييمك يساعدنا على تحسين خدماتنا.

شكراً لوقتك 🙏', 'Hello {{customer_name}} 👋

We hope you are satisfied with the service! 🌟

We would like to know your opinion about:
• Service quality
• Professional {{specialist_name}}
• Your overall experience

Your feedback helps us improve our services.

Thank you for your time 🙏', 'customer');