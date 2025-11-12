import { supabase } from "@/integrations/supabase/client";

interface MessageVariables {
  customer_name?: string;
  order_number?: string;
  service_type?: string;
  booking_date?: string;
  booking_time?: string;
  specialist_name?: string;
  agreed_amount?: string;
  start_time?: string;
  work_duration?: string;
  total_amount?: string;
  extension_duration?: string;
  extension_cost?: string;
  offers_list?: string;
}

/**
 * جلب قالب رسالة واتساب بناءً على المفتاح ولغة العميل
 */
export const getWhatsAppTemplate = async (
  messageKey: string,
  customerLanguage: 'ar' | 'en' = 'ar',
  variables?: MessageVariables
): Promise<string> => {
  try {
    // جلب القالب من قاعدة البيانات
    const { data: template, error } = await supabase
      .from('whatsapp_message_templates')
      .select('template_ar, template_en')
      .eq('message_key', messageKey)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Error fetching WhatsApp template:', error);
      throw error;
    }

    if (!template) {
      throw new Error(`Template not found for key: ${messageKey}`);
    }

    // اختيار القالب المناسب حسب اللغة
    let message = customerLanguage === 'en' ? template.template_en : template.template_ar;

    // استبدال المتغيرات
    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          const placeholder = `{{${key}}}`;
          message = message.replace(new RegExp(placeholder, 'g'), value.toString());
        }
      });
    }

    return message;
  } catch (error) {
    console.error('Failed to get WhatsApp template:', error);
    throw error;
  }
};

/**
 * إرسال رسالة واتساب باستخدام قالب
 */
export const sendTemplateMessage = async (
  to: string,
  messageKey: string,
  customerLanguage: 'ar' | 'en' = 'ar',
  variables?: MessageVariables
) => {
  try {
    const message = await getWhatsAppTemplate(messageKey, customerLanguage, variables);
    
    const { sendWhatsAppMessage } = await import('@/lib/whatsappHelper');
    await sendWhatsAppMessage({
      to,
      message,
      customerName: variables?.customer_name
    });
    
    console.log(`✅ ${messageKey} message sent successfully in ${customerLanguage}`);
  } catch (error) {
    console.error(`Failed to send ${messageKey} message:`, error);
    throw error;
  }
};
