import { supabase } from "@/integrations/supabase/client";

interface SendWhatsAppParams {
  to: string;
  message: string;
  customerName?: string;
}

export const sendWhatsAppMessage = async ({ to, message, customerName }: SendWhatsAppParams) => {
  try {
    console.log('Sending WhatsApp message to:', to);
    
    const { data, error } = await supabase.functions.invoke('send-whatsapp', {
      body: {
        to,
        message,
        customerName
      }
    });

    if (error) {
      console.error('Error sending WhatsApp:', error);
      throw error;
    }

    console.log('WhatsApp sent successfully:', data);
    return data;
  } catch (error) {
    console.error('Failed to send WhatsApp:', error);
    throw error;
  }
};
