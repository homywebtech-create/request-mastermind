import { supabase } from "@/integrations/supabase/client";
import { sendWhatsAppMessage } from "./whatsappHelper";
import { sendInteractiveWhatsAppMessage, formatSpecialistsAsButtons } from "./whatsappInteractiveHelper";

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

    // Prepare specialists as buttons (max 3)
    const specialistButtons = formatSpecialistsAsButtons(
      quotes.map(quote => ({
        id: quote.specialistId,
        name: quote.specialistName,
        quoted_price: `${quote.quotedPrice} ر.س/ساعة`
      }))
    );

    // Build message body
    let messageBody = `مرحباً ${customerName}! 👋\n\n`;
    messageBody += `🎉 *تم استلام ${quotes.length} ${quotes.length === 1 ? 'عرض' : 'عروض'} لطلبك*\n\n`;
    messageBody += `📋 رقم الطلب: *${orderNumber}*\n`;
    messageBody += `🔧 الخدمة: ${serviceType}\n\n`;
    messageBody += `━━━━━━━━━━━━━━━\n\n`;
    
    // Add specialist details
    quotes.forEach((quote, index) => {
      messageBody += `${index + 1}. 👤 *${quote.specialistName}*\n`;
      messageBody += `   🌍 ${quote.specialistNationality}\n`;
      messageBody += `   💰 ${quote.quotedPrice} ر.س/ساعة\n\n`;
    });
    
    messageBody += `━━━━━━━━━━━━━━━\n\n`;
    messageBody += `اختر المحترف المناسب بالضغط على أحد الأزرار أدناه 👇`;

    // Send WhatsApp interactive message with buttons
    await sendInteractiveWhatsAppMessage({
      to: customerPhone,
      message: messageBody,
      buttons: specialistButtons,
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

    // First, get order_specialists with quoted prices (including null is_accepted)
    const { data: orderSpecialists, error: osError } = await supabase
      .from('order_specialists')
      .select('specialist_id, quoted_price')
      .eq('order_id', orderId)
      .not('quoted_price', 'is', null)
      .or('is_accepted.is.null,is_accepted.eq.false');

    if (osError) {
      console.error('Error fetching order_specialists:', osError);
      throw osError;
    }

    if (!orderSpecialists || orderSpecialists.length === 0) {
      console.log('No quotes found for this order');
      return [];
    }

    console.log('Found order_specialists:', orderSpecialists.length);

    // Get specialist IDs
    const specialistIds = orderSpecialists.map(os => os.specialist_id).filter(Boolean);
    
    if (specialistIds.length === 0) {
      console.log('No specialist IDs found');
      return [];
    }

    // Fetch specialists data
    const { data: specialists, error: specError } = await supabase
      .from('specialists')
      .select('id, name, nationality, image_url, company_id')
      .in('id', specialistIds);

    if (specError) {
      console.error('Error fetching specialists:', specError);
      throw specError;
    }

    if (!specialists || specialists.length === 0) {
      console.log('No specialists found');
      return [];
    }

    console.log('Found specialists:', specialists.length);

    // Get company IDs
    const companyIds = specialists.map(s => s.company_id).filter(Boolean);
    
    // Fetch companies data
    const { data: companies, error: compError } = await supabase
      .from('companies')
      .select('id, name')
      .in('id', companyIds);

    if (compError) {
      console.error('Error fetching companies:', compError);
    }

    const companiesMap = new Map(companies?.map(c => [c.id, c.name]) || []);
    const specialistsMap = new Map(specialists.map(s => [s.id, s]));

    // Build quotes array
    const quotes: SpecialistQuote[] = orderSpecialists
      .map(os => {
        const specialist = specialistsMap.get(os.specialist_id);
        if (!specialist) return null;

        const companyName = companiesMap.get(specialist.company_id) || 'Unknown Company';

        const quote: SpecialistQuote = {
          specialistId: specialist.id,
          specialistName: specialist.name,
          specialistNationality: specialist.nationality || 'N/A',
          specialistImageUrl: specialist.image_url || undefined,
          quotedPrice: parseFloat(os.quoted_price) || 0,
          companyId: specialist.company_id,
          companyName
        };
        return quote;
      })
      .filter((q): q is SpecialistQuote => q !== null);

    console.log('✅ Found quotes:', quotes.length);
    return quotes;
  } catch (error) {
    console.error('❌ Failed to fetch quotes:', error);
    throw error;
  }
};
