import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Button {
  type: "reply";
  reply: {
    id: string;
    title: string;
  };
}

interface SpecialistButton {
  specialistId: string;
  name: string;
  price: string;
}

interface WhatsAppInteractiveRequest {
  to: string; // Phone number without whatsapp: prefix (e.g., +966xxxxxxxxx)
  message: string;
  buttons?: SpecialistButton[]; // For specialist offers with buttons
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
    console.log('🚀 [WhatsApp Interactive] Edge function invoked');
    
    const requestBody = await req.json();
    console.log('📥 [WhatsApp Interactive] Request:', JSON.stringify(requestBody, null, 2));
    
    const { to, message, buttons, orderDetails }: WhatsAppInteractiveRequest = requestBody;
    
    // Validate required fields
    if (!to) {
      console.error('❌ Missing required field: to');
      return new Response(
        JSON.stringify({ error: 'Missing required field: to (phone number)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!message) {
      console.error('❌ Missing required field: message');
      return new Response(
        JSON.stringify({ error: 'Missing required field: message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate WhatsApp credentials
    console.log('🔑 [WhatsApp Interactive] Checking credentials...');
    console.log('🔑 Access Token exists:', !!WHATSAPP_ACCESS_TOKEN);
    console.log('🔑 Phone Number ID exists:', !!WHATSAPP_PHONE_NUMBER_ID);
    
    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      console.error('❌ [WhatsApp Interactive] WhatsApp credentials not configured');
      return new Response(
        JSON.stringify({ 
          error: 'WhatsApp credentials not configured',
          details: {
            hasAccessToken: !!WHATSAPP_ACCESS_TOKEN,
            hasPhoneNumberId: !!WHATSAPP_PHONE_NUMBER_ID
          }
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Remove whatsapp: prefix and any + from phone number for Meta API
    const cleanTo = to.replace('whatsapp:', '').replace('+', '');
    console.log(`📱 [WhatsApp Interactive] Sending to: ${cleanTo}`);

    // Prepare WhatsApp Business API URL
    const whatsappUrl = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    
    let messagePayload: any;

    // If buttons are provided, send interactive message
    if (buttons && buttons.length > 0) {
      console.log(`🔘 [WhatsApp Interactive] Sending message with ${buttons.length} buttons`);
      
      // WhatsApp allows maximum 3 buttons
      const limitedButtons = buttons.slice(0, 3);
      
      // Build interactive message with reply buttons
      const interactiveButtons: Button[] = limitedButtons.map((btn, index) => ({
        type: "reply",
        reply: {
          id: `specialist_${btn.specialistId}_${index}`,
          title: `${btn.name} - ${btn.price}`
        }
      }));

      // Build header text with order details
      let headerText = '🎉 عروض المحترفين المتاحة';
      if (orderDetails) {
        headerText = `📋 ${orderDetails.orderNumber || 'طلب جديد'}`;
      }

      messagePayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        type: "interactive",
        interactive: {
          type: "button",
          header: {
            type: "text",
            text: headerText
          },
          body: {
            text: message
          },
          action: {
            buttons: interactiveButtons
          }
        }
      };
    } else {
      // Regular text message
      console.log(`📱 [WhatsApp Interactive] Sending regular text message`);
      messagePayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        type: "text",
        text: {
          preview_url: true,
          body: message
        }
      };
    }

    console.log('📤 [WhatsApp Interactive] Payload:', JSON.stringify(messagePayload, null, 2));

    // Send request to WhatsApp Business API
    const response = await fetch(whatsappUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    });

    const responseData = await response.json();
    console.log('📨 [WhatsApp Interactive] Response:', JSON.stringify(responseData, null, 2));
    
    if (!response.ok) {
      console.error('❌ [WhatsApp Interactive] API error:', responseData);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send WhatsApp message', 
          details: responseData,
          status: response.status 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [WhatsApp Interactive] Message sent successfully!');
    console.log('✅ Message ID:', responseData.messages?.[0]?.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: responseData.messages?.[0]?.id,
        response: responseData
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ [WhatsApp Interactive] Unexpected error:', error);
    console.error('❌ Error message:', error?.message);
    console.error('❌ Error stack:', error?.stack);
    return new Response(
      JSON.stringify({ 
        error: error?.message || 'Unknown error',
        details: 'Internal server error',
        errorType: error?.constructor?.name 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
