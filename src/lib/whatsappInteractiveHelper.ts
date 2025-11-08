import { supabase } from "@/integrations/supabase/client";

interface SpecialistButton {
  specialistId: string;
  name: string;
  price: string;
}

interface SendInteractiveWhatsAppParams {
  to: string;
  message: string;
  buttons?: SpecialistButton[];
  orderDetails?: {
    serviceType: string;
    orderNumber: string;
  };
}

/**
 * Send an interactive WhatsApp message with buttons using Meta WhatsApp Business API
 * Supports up to 3 horizontal buttons for specialist selection
 */
export const sendInteractiveWhatsAppMessage = async ({ 
  to, 
  message, 
  buttons, 
  orderDetails 
}: SendInteractiveWhatsAppParams) => {
  try {
    console.log('📤 Sending interactive WhatsApp message to:', to);
    console.log('🔘 Number of buttons:', buttons?.length || 0);
    
    const { data, error } = await supabase.functions.invoke('send-whatsapp-interactive', {
      body: {
        to,
        message,
        buttons,
        orderDetails
      }
    });

    if (error) {
      console.error('❌ Error sending interactive WhatsApp:', error);
      throw error;
    }

    console.log('✅ Interactive WhatsApp sent successfully:', data);
    return data;
  } catch (error) {
    console.error('❌ Failed to send interactive WhatsApp:', error);
    throw error;
  }
};

/**
 * Format specialist offers as button options (max 3)
 */
export const formatSpecialistsAsButtons = (
  specialists: Array<{
    id: string;
    name: string;
    quoted_price: string;
  }>
): SpecialistButton[] => {
  return specialists.slice(0, 3).map(specialist => ({
    specialistId: specialist.id,
    name: specialist.name,
    price: specialist.quoted_price
  }));
};
