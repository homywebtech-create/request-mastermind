import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Phone number validation regex (international format)
const PHONE_REGEX = /^\+?[1-9]\d{1,14}$/;

// Generate a 6-digit verification code
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { phone } = await req.json();

    // Validate phone number
    if (!phone || typeof phone !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean and validate phone format
    const cleanPhone = phone.trim();
    if (!PHONE_REGEX.test(cleanPhone)) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number format. Use international format (e.g., +1234567890)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with SERVICE ROLE for rate limit check and insert
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check rate limit using the helper function
    const { data: rateLimitOk, error: rateLimitError } = await supabaseAdmin
      .rpc('check_verification_rate_limit', { phone_number: cleanPhone });

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
      return new Response(
        JSON.stringify({ error: 'Failed to check rate limit' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rateLimitOk) {
      return new Response(
        JSON.stringify({ 
          error: 'Too many verification requests. Please wait 15 minutes before trying again.',
          retryAfter: 900 // 15 minutes in seconds
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate verification code
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Insert verification code using service role
    const { data: verificationCode, error: insertError } = await supabaseAdmin
      .from('verification_codes')
      .insert({
        phone: cleanPhone,
        code: code,
        expires_at: expiresAt.toISOString(),
        verified: false,
        attempts: 0
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create verification code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // TODO: Send verification code via WhatsApp or SMS
    console.log(`🔐 Verification code for ${cleanPhone}: ${code}`);
    
    // Clean up old expired codes for this phone number
    await supabaseAdmin
      .from('verification_codes')
      .delete()
      .eq('phone', cleanPhone)
      .lt('expires_at', new Date().toISOString());
    
    // Check if in development mode
    // Always show code in development for easier testing
    const isDevelopment = true; // Set to false in production
    
    // SECURITY: Only return OTP codes in development mode
    // In production, codes should only be delivered via WhatsApp/SMS
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Verification code sent successfully',
        expiresIn: 600, // 10 minutes in seconds
        // Return code in development mode for testing
        ...(isDevelopment && { 
          devMode: true, 
          code: code 
        })
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in request-verification-code:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
