import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_WHATSAPP_NUMBER = Deno.env.get('TWILIO_WHATSAPP_NUMBER');

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
  specialists?: SpecialistQuote[]; // For carousel messages
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
    console.log('🚀 [Twilio WhatsApp] Edge function invoked');
    console.log('🚀 [Twilio WhatsApp] Request method:', req.method);
    
    const requestBody = await req.json();
    console.log('🚀 [Twilio WhatsApp] Request body:', JSON.stringify(requestBody));
    
    const { to, message, customerName, specialists, orderDetails }: WhatsAppMessageRequest = requestBody;
    
    // Check required fields - either message OR specialists list must be provided
    if (!to) {
      console.error('Missing required field: to');
      return new Response(
        JSON.stringify({ error: 'Missing required field: to (phone number)' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!message && (!specialists || specialists.length === 0)) {
      console.error('Missing required fields: message or specialists');
      return new Response(
        JSON.stringify({ error: 'Either message or specialists list is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate Twilio credentials
    console.log('🔑 [Twilio WhatsApp] Checking credentials...');
    console.log('🔑 [Twilio WhatsApp] Account SID exists:', !!TWILIO_ACCOUNT_SID);
    console.log('🔑 [Twilio WhatsApp] Auth Token exists:', !!TWILIO_AUTH_TOKEN);
    console.log('🔑 [Twilio WhatsApp] WhatsApp Number exists:', !!TWILIO_WHATSAPP_NUMBER);
    
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_NUMBER) {
      console.error('❌ [Twilio WhatsApp] Twilio credentials not configured properly');
      return new Response(
        JSON.stringify({ 
          error: 'Twilio credentials not configured',
          details: {
            hasAccountSid: !!TWILIO_ACCOUNT_SID,
            hasAuthToken: !!TWILIO_AUTH_TOKEN,
            hasWhatsAppNumber: !!TWILIO_WHATSAPP_NUMBER
          }
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Format phone number to ensure it starts with whatsapp:
    const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const fromNumber = TWILIO_WHATSAPP_NUMBER.startsWith('whatsapp:') 
      ? TWILIO_WHATSAPP_NUMBER 
      : `whatsapp:${TWILIO_WHATSAPP_NUMBER}`;

    console.log(`📱 [Twilio WhatsApp] Sending WhatsApp message...`);
    console.log(`📱 [Twilio WhatsApp] From: ${fromNumber}`);
    console.log(`📱 [Twilio WhatsApp] To: ${toNumber}`);

    // Prepare Twilio API request
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append('To', toNumber);
    formData.append('From', fromNumber);

    // If specialists array is provided, send formatted message with media
    if (specialists && specialists.length > 0) {
      console.log(`📱 [Twilio WhatsApp] Sending specialist offers with ${specialists.length} specialists`);
      
      // Build a single message with all specialists
      let combinedMessage = `🎉 *عروض جديدة من محترفين!*\n\n`;
      combinedMessage += `━━━━━━━━━━━━━━━\n`;
      combinedMessage += `📋 *رقم الطلب:* ${orderDetails?.orderNumber || 'N/A'}\n`;
      combinedMessage += `🔧 *الخدمة:* ${orderDetails?.serviceType || 'N/A'}\n`;
      combinedMessage += `━━━━━━━━━━━━━━━\n\n`;
      
      // Add all specialists to the same message
      specialists.forEach((specialist, index) => {
        combinedMessage += `*${index + 1}. ${specialist.name}* 🧹\n`;
        combinedMessage += `🌍 الجنسية: ${specialist.nationality}\n`;
        combinedMessage += `💰 السعر: *${specialist.price} ریال/ساعة*\n`;
        
        // Add image link if available
        if (specialist.imageUrl) {
          combinedMessage += `📸 الصورة: ${specialist.imageUrl}\n`;
        }
        
        combinedMessage += `🔗 للحجز: ${specialist.companyPageUrl}\n`;
        combinedMessage += `\n━━━━━━━━━━━━━━━\n\n`;
      });
      
      combinedMessage += `✅ _اختر المحترف المناسب واضغط على رابط الحجز_`;
      
      formData.append('Body', combinedMessage);
      
      console.log(`📱 [Twilio WhatsApp] Sending combined message with ${specialists.length} specialists`);
    } else {
      // Regular text message
      console.log(`📱 [Twilio WhatsApp] Sending regular text message (${message.length} chars)`);
      formData.append('Body', message);
    }

    // Send request to Twilio
    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('❌ [Twilio WhatsApp] API error:', JSON.stringify(responseData));
      console.error('❌ [Twilio WhatsApp] Status:', response.status);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send WhatsApp message', 
          details: responseData,
          status: response.status 
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✅ [Twilio WhatsApp] Message sent successfully!');
    console.log('✅ [Twilio WhatsApp] Message SID:', responseData.sid);
    console.log('✅ [Twilio WhatsApp] Status:', responseData.status);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageSid: responseData.sid,
        status: responseData.status 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('❌ [Twilio WhatsApp] Unexpected error:', error);
    console.error('❌ [Twilio WhatsApp] Error message:', error?.message);
    console.error('❌ [Twilio WhatsApp] Error stack:', error?.stack);
    return new Response(
      JSON.stringify({ 
        error: error?.message || 'Unknown error',
        details: 'Internal server error',
        errorType: error?.constructor?.name 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
