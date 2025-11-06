import { supabase } from "@/integrations/supabase/client";

interface SpecialistQuote {
  name: string;
  nationality: string;
  imageUrl?: string;
  price: number;
  companyPageUrl: string;
  specialistId: string;
}

interface SendWhatsAppParams {
  to: string;
  message: string;
  customerName?: string;
  specialists?: SpecialistQuote[];
  orderDetails?: {
    serviceType: string;
    orderNumber: string;
  };
}

export const sendWhatsAppMessage = async ({ 
  to, 
  message, 
  customerName, 
  specialists, 
  orderDetails 
}: SendWhatsAppParams) => {
  try {
    console.log('Sending WhatsApp message to:', to);
    
    const { data, error } = await supabase.functions.invoke('send-whatsapp', {
      body: {
        to,
        message,
        customerName,
        specialists,
        orderDetails
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
