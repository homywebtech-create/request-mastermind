import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')?.trim();
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')?.trim();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SpecialistQuote {
  name: string;
  nationality: string;
  imageUrl?: string;
  price: number;
  companyPageUrl: string;
  specialistId: string;
}

interface WhatsAppMessageRequest {
  to: string; // Phone number in format: +966xxxxxxxxx
  message: string;
  customerName?: string;
  specialists?: SpecialistQuote[];
  orderDetails?: {
    serviceType: string;
    orderNumber: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 [Meta WhatsApp] Edge function invoked');
    
    const requestBody = await req.json();
    console.log('🚀 [Meta WhatsApp] Request body:', JSON.stringify(requestBody));
    
    const { to, message, specialists, orderDetails }: WhatsAppMessageRequest = requestBody;
    
    // Check required fields
    if (!to) {
      console.error('❌ Missing required field: to');
      return new Response(
        JSON.stringify({ error: 'Missing required field: to (phone number)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!message && (!specialists || specialists.length === 0)) {
      console.error('❌ Missing required fields: message or specialists');
      return new Response(
        JSON.stringify({ error: 'Either message or specialists list is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate Meta credentials
    console.log('🔑 [Meta WhatsApp] Checking credentials...');
    console.log('🔑 Access Token exists:', !!WHATSAPP_ACCESS_TOKEN);
    console.log('🔑 Phone Number ID exists:', !!WHATSAPP_PHONE_NUMBER_ID);
    
    // Debug token format (log length and first/last chars for debugging)
    if (WHATSAPP_ACCESS_TOKEN) {
      console.log('🔍 Token length:', WHATSAPP_ACCESS_TOKEN.length);
      console.log('🔍 Token starts with:', WHATSAPP_ACCESS_TOKEN.substring(0, 10));
      console.log('🔍 Token ends with:', WHATSAPP_ACCESS_TOKEN.substring(WHATSAPP_ACCESS_TOKEN.length - 10));
      
      // Check for common issues
      if (WHATSAPP_ACCESS_TOKEN.includes('"') || WHATSAPP_ACCESS_TOKEN.includes("'")) {
        console.error('⚠️ Token contains quotes - remove them!');
      }
      if (WHATSAPP_ACCESS_TOKEN.includes('\n') || WHATSAPP_ACCESS_TOKEN.includes('\r')) {
        console.error('⚠️ Token contains newlines - remove them!');
      }
      if (!WHATSAPP_ACCESS_TOKEN.startsWith('EAAQ')) {
        console.error('⚠️ Token should start with EAAQ for Meta permanent tokens');
      }
    }
    
    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      console.error('❌ [Meta WhatsApp] Credentials not configured');
      return new Response(
        JSON.stringify({ 
          error: 'Meta WhatsApp credentials not configured',
          details: {
            hasAccessToken: !!WHATSAPP_ACCESS_TOKEN,
            hasPhoneNumberId: !!WHATSAPP_PHONE_NUMBER_ID
          }
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Remove 'whatsapp:' prefix if present and ensure number has country code
    let toNumber = to.replace('whatsapp:', '').trim();
    // Remove + if present (Meta API doesn't need it in the phone number)
    toNumber = toNumber.replace('+', '').trim();

    console.log(`📱 [Meta WhatsApp] Sending message to: ${toNumber}`);

    // Meta WhatsApp Business API endpoint
    const metaUrl = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

    // If specialists array is provided, send each as a separate message
    if (specialists && specialists.length > 0) {
      console.log(`📱 [Meta WhatsApp] Sending ${specialists.length} specialist offers`);
      
      for (const specialist of specialists) {
        console.log(`📸 [Meta WhatsApp] Sending specialist: ${specialist.name}`);
        
        // Build specialist message
        let specialistMessage = `🎉 *عرض جديد من محترف!*\n\n`;
        specialistMessage += `━━━━━━━━━━━━━━━\n`;
        specialistMessage += `📋 *رقم الطلب:* ${orderDetails?.orderNumber || 'N/A'}\n`;
        specialistMessage += `🔧 *الخدمة:* ${orderDetails?.serviceType || 'N/A'}\n`;
        specialistMessage += `━━━━━━━━━━━━━━━\n\n`;
        specialistMessage += `👤 *${specialist.name}* 🧹\n`;
        specialistMessage += `🌍 الجنسية: ${specialist.nationality}\n`;
        specialistMessage += `💰 السعر: *${specialist.price} ریال/ساعة*\n\n`;
        specialistMessage += `━━━━━━━━━━━━━━━\n`;
        specialistMessage += `🔗 *للحجز اضغط على الرابط:*\n`;
        specialistMessage += `${specialist.companyPageUrl}\n\n`;
        specialistMessage += `✅ _اضغط لإتمام الحجز_`;

        const messagePayload: any = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: toNumber,
          type: "text",
          text: {
            preview_url: true,
            body: specialistMessage
          }
        };

        // Add image if available
        if (specialist.imageUrl) {
          messagePayload.type = "image";
          messagePayload.image = {
            link: specialist.imageUrl,
            caption: specialistMessage
          };
          delete messagePayload.text;
        }

        try {
          // Add timeout to prevent hanging
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          const response = await fetch(metaUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(messagePayload),
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);

          const responseData = await response.json();

          if (!response.ok) {
            console.error(`❌ [Meta WhatsApp] Failed for ${specialist.name}:`, responseData);
          } else {
            console.log(`✅ [Meta WhatsApp] Sent ${specialist.name} - Message ID:`, responseData.messages?.[0]?.id);
          }

          // Delay between messages
          if (specialists.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (err: any) {
          if (err.name === 'AbortError') {
            console.error(`⏱️ [Meta WhatsApp] Timeout for ${specialist.name}`);
          } else {
            console.error(`❌ [Meta WhatsApp] Error for ${specialist.name}:`, err);
          }
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Sent ${specialists.length} specialist offers`
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Regular text message
    console.log(`📱 [Meta WhatsApp] Sending text message (${message.length} chars)`);

    const messagePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toNumber,
      type: "text",
      text: {
        preview_url: false,
        body: message
      }
    };

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(metaUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('❌ [Meta WhatsApp] API error:', JSON.stringify(responseData));
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send WhatsApp message', 
          details: responseData,
          status: response.status 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [Meta WhatsApp] Message sent!');
    console.log('✅ Message ID:', responseData.messages?.[0]?.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: responseData.messages?.[0]?.id,
        details: responseData
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ [Meta WhatsApp] Unexpected error:', error);
    
    // Handle timeout specifically
    if (error.name === 'AbortError') {
      return new Response(
        JSON.stringify({ 
          error: 'Request timeout - WhatsApp API took too long to respond',
          details: 'Please check your WhatsApp Business API credentials and connection'
        }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        error: error?.message || 'Unknown error',
        details: error?.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
