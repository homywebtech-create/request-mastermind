import { supabase } from "@/integrations/supabase/client";
import { sendWhatsAppMessage } from "./whatsappHelper";

interface SpecialistQuote {
  specialistId: string;
  specialistName: string;
  specialistNationality: string;
  specialistImageUrl?: string;
  quotedPrice: number;
  companyId: string;
  companyName: string;
}

interface SendCarouselParams {
  customerPhone: string;
  customerName: string;
  orderNumber: string;
  serviceType: string;
  quotes: SpecialistQuote[];
}

export const sendWhatsAppCarouselToCustomer = async ({
  customerPhone,
  customerName,
  orderNumber,
  serviceType,
  quotes
}: SendCarouselParams) => {
  try {
    console.log('📱 Preparing WhatsApp carousel for customer:', customerPhone);
    console.log('📋 Number of quotes:', quotes.length);

    if (quotes.length === 0) {
      throw new Error('No quotes available to send');
    }

    // Prepare specialists data with company page URLs
    const specialists = quotes.map(quote => ({
      name: quote.specialistName,
      nationality: quote.specialistNationality,
      imageUrl: quote.specialistImageUrl,
      price: quote.quotedPrice,
      companyPageUrl: `${window.location.origin}/company-booking?company=${quote.companyId}&specialist=${quote.specialistId}&order=${orderNumber}`,
      specialistId: quote.specialistId
    }));

    // Send WhatsApp message with specialists list
    await sendWhatsAppMessage({
      to: customerPhone,
      message: '', // Message will be built in edge function
      customerName,
      specialists,
      orderDetails: {
        serviceType,
        orderNumber
      }
    });

    console.log('✅ WhatsApp carousel sent successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to send WhatsApp carousel:', error);
    throw error;
  }
};

export const fetchQuotesForOrder = async (orderId: string): Promise<SpecialistQuote[]> => {
  try {
    console.log('🔍 Fetching quotes for order:', orderId);

    const { data: orderSpecialists, error } = await supabase
      .from('order_specialists')
      .select(`
        specialist_id,
        quoted_price,
        specialists!inner (
          id,
          name,
          nationality,
          image_url,
          company_id,
          companies!inner (
            id,
            name
          )
        )
      `)
      .eq('order_id', orderId)
      .not('quoted_price', 'is', null)
      .eq('is_accepted', false);

    if (error) {
      console.error('Error fetching quotes:', error);
      throw error;
    }

    if (!orderSpecialists || orderSpecialists.length === 0) {
      console.log('No quotes found for this order');
      return [];
    }

    const quotes: SpecialistQuote[] = orderSpecialists.map((os: any) => ({
      specialistId: os.specialists.id,
      specialistName: os.specialists.name,
      specialistNationality: os.specialists.nationality,
      specialistImageUrl: os.specialists.image_url,
      quotedPrice: os.quoted_price,
      companyId: os.specialists.company_id,
      companyName: os.specialists.companies.name
    }));

    console.log('✅ Found quotes:', quotes.length);
    return quotes;
  } catch (error) {
    console.error('❌ Failed to fetch quotes:', error);
    throw error;
  }
};
