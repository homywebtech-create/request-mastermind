import { supabase } from "@/integrations/supabase/client";

/**
 * إرسال طلب موقع للعميل عبر WhatsApp
 */
export const requestCustomerLocation = async (
  customerPhone: string,
  orderNumber: string
) => {
  try {
    console.log("📍 Requesting location from customer:", customerPhone);

    const message = `مرحباً 👋

نحتاج إلى موقعك لتأكيد الطلب رقم: ${orderNumber}

الرجاء الضغط على زر "مشاركة الموقع" أدناه لإرسال موقعك إلينا.`;

    // إرسال رسالة نصية تطلب الموقع
    const { data, error } = await supabase.functions.invoke("send-whatsapp", {
      body: {
        to: customerPhone,
        message: message,
      },
    });

    if (error) {
      console.error("❌ Error requesting location:", error);
      throw error;
    }

    console.log("✅ Location request sent successfully");
    return data;
  } catch (error) {
    console.error("❌ Failed to request location:", error);
    throw error;
  }
};

/**
 * التحقق من وجود موقع محفوظ للطلب
 */
export const checkOrderLocation = async (orderId: string) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("customer_latitude, customer_longitude, customer_location_address, customer_location_name")
      .eq("id", orderId)
      .single();

    if (error) throw error;

    const hasLocation = !!(data.customer_latitude && data.customer_longitude);
    
    return {
      hasLocation,
      location: hasLocation ? {
        latitude: data.customer_latitude,
        longitude: data.customer_longitude,
        address: data.customer_location_address,
        name: data.customer_location_name,
      } : null,
    };
  } catch (error) {
    console.error("❌ Error checking order location:", error);
    throw error;
  }
};
