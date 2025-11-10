import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')?.trim();
    const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')?.trim();

    console.log('🔍 Verifying WhatsApp Configuration...');
    console.log('📋 Phone Number ID:', WHATSAPP_PHONE_NUMBER_ID);
    console.log('🔑 Access Token exists:', !!WHATSAPP_ACCESS_TOKEN);
    console.log('🔑 Access Token length:', WHATSAPP_ACCESS_TOKEN?.length || 0);

    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Missing credentials',
          details: {
            hasAccessToken: !!WHATSAPP_ACCESS_TOKEN,
            hasPhoneNumberId: !!WHATSAPP_PHONE_NUMBER_ID
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to fetch phone number details from Meta
    const url = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}`;
    console.log('🌐 Testing URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      },
    });

    const data = await response.json();
    console.log('📥 Meta API Response:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Phone Number ID not found or Access Token invalid',
          phoneNumberId: WHATSAPP_PHONE_NUMBER_ID,
          statusCode: response.status,
          metaError: data,
          possibleIssues: [
            '1. Phone Number ID does not exist in your WhatsApp Business Account',
            '2. Access Token does not have permission to access this Phone Number',
            '3. Access Token belongs to a different WhatsApp Business Account',
            '4. Phone Number ID or Access Token has whitespace/special characters'
          ]
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'WhatsApp configuration is valid!',
        phoneNumberId: WHATSAPP_PHONE_NUMBER_ID,
        phoneNumberDetails: data
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Verification error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error?.message || 'Unknown error',
        stack: error?.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
